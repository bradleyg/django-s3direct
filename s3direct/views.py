import hashlib
import uuid
import hmac
import json
import os
from base64 import b64encode

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@require_POST
@csrf_exempt
def get_upload_params(request, upload_to):
    destinations = settings.S3DIRECT_DESTINATIONS
    content_type = request.POST['type']
    source_filename = request.POST['name']
    if upload_to in destinations:
        dest = dict(map(None, ('path', 'permission', 'accepted-types'), destinations[upload_to]))
        if dest['permission'](request.user):
            if dest['accepted-types']:
                if not content_type in dest['accepted-types']:
                    wildcard_types = (x for x in dest['accepted-types'] if x.split('/')[-1] == '*')
                    for wildcard in wildcard_types:
                        if not wildcard == content_type:
                            raise PermissionDenied()
            data = create_upload_data(content_type, source_filename, dest.get('path'))
            return HttpResponse(json.dumps(data), content_type="application/json")
    raise PermissionDenied()


def create_upload_data(content_type, source_filename, path):
    access_key = settings.AWS_ACCESS_KEY_ID
    secret_access_key = settings.AWS_SECRET_ACCESS_KEY
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    expires = (timezone.now() + settings.S3DIRECT_EXPIRATION).isoformat()
    policy_object = json.dumps({
        "expiration": expires,
        "conditions": [
            {"bucket": bucket},
            {"acl": "public-read"},
            {"Content-Type": content_type},
            ["starts-with", "$key", ""],
            {"success_action_status": "201"}
        ]
    })

    policy = b64encode(policy_object.replace('\n', '').replace('\r', ''))
    signature = hmac.new(secret_access_key, policy, hashlib.sha1).digest()
    signature_b64 = b64encode(signature)

    if settings.S3DIRECT_UNIQUE_RENAME:
        ext = source_filename.split('.')[-1]
        filename = '%s.%s' % (uuid.uuid4(), ext)
    else:
        filename = '${filename}'
    key = os.path.join(path, filename)

    return {
        "policy": policy,
        "signature": signature_b64,
        "key": key,
        "AWSAccessKeyId": access_key,
        "form_action": settings.MEDIA_URL,
        "success_action_status": "201",
        "acl": "public-read",
        "Content-Type": content_type
    }