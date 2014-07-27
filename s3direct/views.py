import json

from django.http import HttpResponse
from django.views.decorators.http import require_POST
from django.core.exceptions import PermissionDenied
from django.conf import settings

from .utils import create_upload_data


S3DIRECT_AUTH_TEST = getattr(settings, 'S3DIRECT_AUTH_TEST', lambda u: True)


@require_POST
def get_upload_params(request):
    if not S3DIRECT_AUTH_TEST(request.user):
        raise PermissionDenied()

    content_type = request.POST['type']
    source_filename = request.POST['name']
    upload_to = request.POST['upload_to']
    data = create_upload_data(content_type, source_filename, upload_to)
    return HttpResponse(json.dumps(data), content_type="application/json")
