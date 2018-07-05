import json
from os.path import splitext

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.http import require_POST
from django.utils.text import get_valid_filename

import boto3

from .utils import (
    create_upload_data,
    get_s3upload_destinations,
    get_signed_download_url
)


@require_POST
def get_upload_params(request):

    content_type = request.POST['type']
    filename = get_valid_filename(request.POST['name'])
    dest = get_s3upload_destinations().get(request.POST['dest'])

    if not dest:
        data = json.dumps({'error': 'File destination does not exist.'})
        return HttpResponse(data, content_type="application/json", status=400)

    key = dest.get('key')
    auth = dest.get('auth')
    allowed_types = dest.get('allowed_types')
    acl = dest.get('acl')
    bucket = dest.get('bucket')
    cache_control = dest.get('cache_control')
    content_disposition = dest.get('content_disposition')
    content_length_range = dest.get('content_length_range')
    allowed_extensions = dest.get('allowed_extensions')
    server_side_encryption = dest.get('server_side_encryption')

    if not acl:
        acl = 'public-read'

    if not key:
        data = json.dumps({'error': 'Missing destination path.'})
        return HttpResponse(data, content_type="application/json", status=403)

    if auth and not auth(request.user):
        data = json.dumps({'error': 'Permission denied.'})
        return HttpResponse(data, content_type="application/json", status=403)

    if (allowed_types and content_type not in allowed_types) and allowed_types != '*':
        data = json.dumps({'error': 'Invalid file type (%s).' % content_type})
        return HttpResponse(data, content_type="application/json", status=400)

    original_ext = splitext(filename)[1]
    lowercased_ext = original_ext.lower()
    if (allowed_extensions and lowercased_ext not in allowed_extensions) and allowed_extensions != '*':
        data = json.dumps({'error': 'Forbidden file extension (%s).' % original_ext})
        return HttpResponse(data, content_type="application/json", status=415)

    if hasattr(key, '__call__'):
        key = key(filename)
    elif key == '/':
        key = filename
    else:
        key = '{0}/{1}'.format(key, filename)

    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
    secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
    token = None

    if access_key is None or secret_access_key is None:
        # Get credentials from instance profile if not defined in settings --
        # this avoids the need to put access credentials in the settings.py file.
        # Assumes we're running on EC2.

        try:
            from botocore.credentials import InstanceMetadataProvider, InstanceMetadataFetcher
        except ImportError:
            InstanceMetadataProvider = None
            InstanceMetadataFetcher = None

        if all([InstanceMetadataProvider, InstanceMetadataFetcher]):
            provider = InstanceMetadataProvider(iam_role_fetcher=InstanceMetadataFetcher(timeout=1000, num_attempts=2))
            creds = provider.load()
            access_key = creds.access_key
            secret_access_key = creds.secret_key
            token = creds.token
        else:
            data = json.dumps({'error': 'Failed to access EC2 instance metadata due to missing dependency.'})
            return HttpResponse(data, content_type="application/json", status=500)

    data = create_upload_data(
        content_type, key, acl, bucket, cache_control, content_disposition,
        content_length_range, server_side_encryption, access_key, secret_access_key, token
    )

    url = None

    # Generate signed URL for private document access
    if acl == "private":
        url = get_signed_download_url(
            key=key.replace("${filename}", filename),
            bucket_name=bucket or settings.AWS_STORAGE_BUCKET_NAME,
            ttl=int(5*60),  # 5 mins
        )

    response = {
        "aws_payload": data,
        "private_access_url": url,
    }

    return HttpResponse(json.dumps(response), content_type="application/json")
