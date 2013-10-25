import sha, uuid, hmac, json
from datetime import datetime, timedelta
from base64 import b64encode
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import user_passes_test
from django.views.decorators.http import require_POST


S3DIRECT_DIR = getattr(settings, "S3DIRECT_DIR", 's3direct')


@csrf_exempt
@require_POST
@user_passes_test(lambda u: u.is_staff)
def get_upload_params(request, upload_to=''):
    
    content_type = request.POST['type']
    expires = (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    policy_object = json.dumps({
        "expiration": expires,
        "conditions": [
            {"bucket": settings.AWS_STORAGE_BUCKET_NAME},
            {"acl": "public-read"},
            {"Content-Type": content_type},
            ["starts-with", "$key", ""],
            {"success_action_status": "201"}
        ]
    })
    
    policy = b64encode(policy_object.replace('\n', '').replace('\r', ''))
    signature = b64encode(hmac.new(settings.AWS_SECRET_ACCESS_KEY, policy, sha).digest())
    key = "%s/%s/${filename}" % (upload_to or S3DIRECT_DIR, uuid.uuid4().hex)
    
    data = {
        "policy": policy,
        "signature": signature,
        "key": key,
        "AWSAccessKeyId": settings.AWS_ACCESS_KEY_ID,
        "form_action": "https://%s.s3.amazonaws.com" % settings.AWS_STORAGE_BUCKET_NAME,
        "success_action_status": "201",
        "acl": "public-read",
        "Content-Type": content_type
    }

    return HttpResponse(json.dumps(data), content_type="application/json")