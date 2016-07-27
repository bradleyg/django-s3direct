import json

from django.http import HttpResponse
from django.views.decorators.http import require_POST

from .utils import create_upload_data, get_s3direct_destinations


@require_POST
def get_upload_params(request):
    content_type = request.POST['type']
    filename = request.POST['name']

    dest = get_s3direct_destinations().get(request.POST['dest'])

    if not dest:
        data = json.dumps({'error': 'File destination does not exist.'})
        return HttpResponse(data, content_type="application/json", status=400)

    key = dest.get('key')
    auth = dest.get('auth')
    allowed = dest.get('allowed')
    acl = dest.get('acl')
    bucket = dest.get('bucket')
    cache_control = dest.get('cache_control')
    content_disposition = dest.get('content_disposition')
    content_length_range = dest.get('content_length_range')
    server_side_encryption = dest.get('server_side_encryption')

    if not acl:
        acl = 'public-read'

    if not key:
        data = json.dumps({'error': 'Missing destination path.'})
        return HttpResponse(data, content_type="application/json", status=403)

    if auth and not auth(request.user):
        data = json.dumps({'error': 'Permission denied.'})
        return HttpResponse(data, content_type="application/json", status=403)

    if (allowed and content_type not in allowed) and allowed != '*':
        data = json.dumps({'error': 'Invalid file type (%s).' % content_type})
        return HttpResponse(data, content_type="application/json", status=400)

    if hasattr(key, '__call__'):
        key = key(filename)
    elif key == '/':
        key = '${filename}'
    else:
        # The literal string '${filename}' is an S3 field variable for key.
        # https://aws.amazon.com/articles/1434#aws-table
        key = '%s/${filename}' % key

    data = create_upload_data(
        content_type, key, acl, bucket, cache_control, content_disposition, content_length_range,
        server_side_encryption
    )

    return HttpResponse(json.dumps(data), content_type="application/json")
