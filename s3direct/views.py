import json

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import user_passes_test
from django.views.decorators.http import require_POST

from .utils import create_upload_data


@csrf_exempt
@require_POST
@user_passes_test(lambda u: u.is_staff)
def get_upload_params(request):
    content_type = request.POST['type']
    source_filename = request.POST['name']
    upload_to = request.POST['upload_to']
    data = create_upload_data(content_type, source_filename, upload_to)
    return HttpResponse(json.dumps(data), content_type="application/json")


