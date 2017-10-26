import json
from datetime import datetime
try:
    from urllib.parse import unquote
except ImportError:
    from urlparse import unquote

from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseNotFound, \
    HttpResponseServerError
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from .utils import get_aws_v4_signature, get_aws_v4_signing_key, get_s3direct_destinations


@csrf_protect
@require_POST
def get_upload_params(request):
    """Authorises user and validates given file properties."""
    file_name = request.POST['name']
    file_type = request.POST['type']
    file_size = int(request.POST['size'])
    dest = get_s3direct_destinations().get(request.POST['dest'])
    if not dest:
        return HttpResponseNotFound(json.dumps({'error': 'File destination does not exist.'}),
                                    content_type='application/json')

    # Validate request and destination config:
    allowed = dest.get('allowed')
    auth = dest.get('auth')
    key = dest.get('key')
    content_length_range = dest.get('content_length_range')

    if auth and not auth(request.user):
        return HttpResponseForbidden(json.dumps({'error': 'Permission denied.'}), content_type='application/json')

    if (allowed and file_type not in allowed) and allowed != '*':
        return HttpResponseBadRequest(json.dumps({'error': 'Invalid file type (%s).' % file_type}),
                                      content_type='application/json')

    if content_length_range and not content_length_range[0] <= file_size <= content_length_range[1]:
        return HttpResponseBadRequest(
            json.dumps({'error': 'Invalid file size (must be between %s and %s bytes).' % content_length_range}),
            content_type='application/json')

    # Generate object key
    if not key:
        return HttpResponseServerError(json.dumps({'error': 'Missing destination path.'}),
                                       content_type='application/json')
    elif hasattr(key, '__call__'):
        object_key = key(file_name)
    elif key == '/':
        object_key = file_name
    else:
        object_key = '%s/%s' % (key.strip('/'), file_name)

    bucket = dest.get('bucket') or settings.AWS_STORAGE_BUCKET_NAME
    region = dest.get('region') or getattr(settings, 'S3DIRECT_REGION', None) or 'us-east-1'
    endpoint = 's3.amazonaws.com' if region == 'us-east-1' else ('s3-%s.amazonaws.com' % region)

    # AWS credentials are not required for publicly-writable buckets
    access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', None)

    bucket_url = 'https://{0}/{1}'.format(endpoint, bucket)

    upload_data = {
        'object_key': object_key,
        'access_key_id': access_key_id,
        'region': region,
        'bucket': bucket,
        'bucket_url': bucket_url,
        'cache_control': dest.get('cache_control'),
        'content_disposition': dest.get('content_disposition'),
        'acl': dest.get('acl') or 'public-read',
        'server_side_encryption': dest.get('server_side_encryption'),
    }
    return HttpResponse(json.dumps(upload_data), content_type='application/json')


@csrf_protect
@require_POST
def generate_aws_v4_signature(request):
    message = unquote(request.POST['to_sign'])
    signing_date = datetime.strptime(request.POST['datetime'], '%Y%m%dT%H%M%SZ')
    signing_key = get_aws_v4_signing_key(settings.AWS_SECRET_ACCESS_KEY, signing_date, settings.S3DIRECT_REGION, 's3')
    signature = get_aws_v4_signature(signing_key, message)
    return HttpResponse(signature)
