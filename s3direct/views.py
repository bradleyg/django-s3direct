import hashlib, uuid, hmac, json, os
from datetime import datetime, timedelta
from base64 import b64encode
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@require_POST
@csrf_exempt
def get_upload_params(request, upload_to):
    content_type = request.POST['type']
    source_filename = request.POST['name']
    if upload_to in settings.S3DIRECT_DESTINATIONS:
        path, permission = settings.S3DIRECT_DESTINATIONS[upload_to]
        if permission(request.user):
            data = create_upload_data(content_type, source_filename, path)
            return HttpResponse(json.dumps(data), content_type="application/json")
    raise PermissionDenied()


def create_upload_data(content_type, source_filename, path):
    access_key = settings.AWS_ACCESS_KEY_ID
    secret_access_key = settings.AWS_SECRET_ACCESS_KEY
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    s3_host = settings.S3DIRECT_ENDPOINT


    expires_in = datetime.now() + timedelta(hours=24)
    expires = expires_in.strftime('%Y-%m-%dT%H:%M:%S.000Z')

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
    url = 'https://%s.%s/' % (bucket, s3_host)

    return {
        "policy": policy,
        "signature": signature_b64,
        "key": key,
        "AWSAccessKeyId": access_key,
        "form_action": url,
        "success_action_status": "201",
        "acl": "public-read",
        "Content-Type": content_type
    }