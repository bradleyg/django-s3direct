import json
from inspect import isfunction

from django.http import HttpResponse
from django.views.decorators.http import require_POST
from django.conf import settings

from .utils import create_upload_data, get_at


DESTINATIONS = getattr(settings, 'S3DIRECT_DESTINATIONS', None)


@require_POST
def get_upload_params(request):
    content_type = request.POST['type']
    filename = request.POST['name']

    dest = DESTINATIONS.get(request.POST['dest'])

    if not dest:
        data = json.dumps({'error': 'File destination does not exist.'})
        return HttpResponse(data, content_type="application/json", status=400)

    key = get_at(0, dest)
    auth = get_at(1, dest)
    allowed = get_at(2, dest)
    acl = get_at(3, dest)
    bucket = get_at(4, dest)

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

    if isfunction(key):
        key = key(filename)
    else:
        key = '%s/${filename}' % key

    data = create_upload_data(content_type, key, acl, bucket)

    return HttpResponse(json.dumps(data), content_type="application/json")
