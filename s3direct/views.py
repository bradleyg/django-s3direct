import json
from datetime import datetime
from django.conf import settings
from django.http import (HttpResponse, HttpResponseBadRequest,
                         HttpResponseForbidden, HttpResponseNotFound,
                         HttpResponseServerError)
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
try:
    from urllib.parse import unquote
except ImportError:
    from urlparse import unquote
from .utils import (get_aws_credentials, get_aws_v4_signature,
                    get_aws_v4_signing_key, get_s3direct_destinations, get_key)


@csrf_protect
@require_POST
def get_upload_params(request):
    """Authorises user and validates given file properties."""
    file_name = request.POST['name']
    file_type = request.POST['type']
    file_size = int(request.POST['size'])

    dest = get_s3direct_destinations().get(request.POST.get('dest', None),
                                           None)
    if not dest:
        resp = json.dumps({'error': 'File destination does not exist.'})
        return HttpResponseNotFound(resp, content_type='application/json')

    auth = dest.get('auth')
    if auth and not auth(request.user):
        resp = json.dumps({'error': 'Permission denied.'})
        return HttpResponseForbidden(resp, content_type='application/json')

    allowed = dest.get('allowed')
    if (allowed and file_type not in allowed) and allowed != '*':
        resp = json.dumps({'error': 'Invalid file type (%s).' % file_type})
        return HttpResponseBadRequest(resp, content_type='application/json')

    cl_range = dest.get('content_length_range')
    if (cl_range and not cl_range[0] <= file_size <= cl_range[1]):
        msg = 'Invalid file size (must be between %s and %s bytes).'
        resp = json.dumps({'error': (msg % cl_range)})
        return HttpResponseBadRequest(resp, content_type='application/json')

    key = dest.get('key')
    if not key:
        resp = json.dumps({'error': 'Missing destination path.'})
        return HttpResponseServerError(resp, content_type='application/json')

    bucket = dest.get('bucket',
                      getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None))
    if not bucket:
        resp = json.dumps({'error': 'S3 bucket config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    region = dest.get('region', getattr(settings, 'AWS_S3_REGION_NAME', None))
    if not region:
        resp = json.dumps({'error': 'S3 region config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    endpoint = dest.get('endpoint',
                        getattr(settings, 'AWS_S3_ENDPOINT_URL', None))
    if not endpoint:
        resp = json.dumps({'error': 'S3 endpoint config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    aws_credentials = get_aws_credentials()
    if not aws_credentials.secret_key or not aws_credentials.access_key:
        resp = json.dumps({'error': 'AWS credentials config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    upload_data = {
        'object_key':
        get_key(key, file_name, dest),
        'access_key_id':
        aws_credentials.access_key,
        'session_token':
        aws_credentials.token,
        'region':
        region,
        'bucket':
        bucket,
        'endpoint':
        endpoint,
        'acl':
        dest.get('acl') or 'public-read',
        'allow_existence_optimization':
        dest.get('allow_existence_optimization', False)
    }

    optional_params = [
        'content_disposition', 'cache_control', 'server_side_encryption'
    ]

    for optional_param in optional_params:
        if optional_param in dest:
            option = dest.get(optional_param)
            if hasattr(option, '__call__'):
                upload_data[optional_param] = option(file_name)
            else:
                upload_data[optional_param] = option

    resp = json.dumps(upload_data)
    return HttpResponse(resp, content_type='application/json')


@csrf_protect
@require_POST
def generate_aws_v4_signature(request):
    message = unquote(request.POST['to_sign'])
    dest = get_s3direct_destinations().get(unquote(request.POST['dest']))
    signing_date = datetime.strptime(request.POST['datetime'],
                                     '%Y%m%dT%H%M%SZ')

    auth = dest.get('auth')
    if auth and not auth(request.user):
        resp = json.dumps({'error': 'Permission denied.'})
        return HttpResponseForbidden(resp, content_type='application/json')

    region = dest.get('region') or getattr(settings, 'AWS_S3_REGION_NAME',
                                           None)
    if not region:
        resp = json.dumps({'error': 'S3 region config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    aws_credentials = get_aws_credentials()
    if not aws_credentials.secret_key or not aws_credentials.access_key:
        resp = json.dumps({'error': 'AWS credentials config missing.'})
        return HttpResponseServerError(resp, content_type='application/json')

    signing_key = get_aws_v4_signing_key(aws_credentials.secret_key,
                                         signing_date, region, 's3')

    signature = get_aws_v4_signature(signing_key, message)
    resp = json.dumps({'s3ObjKey': signature})
    return HttpResponse(resp, content_type='application/json')
