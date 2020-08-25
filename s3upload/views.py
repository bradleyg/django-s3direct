from __future__ import annotations

from os.path import splitext

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.utils.text import get_valid_filename
from django.views.decorators.http import require_POST

from .utils import create_upload_data, get_signed_download_url


@require_POST
def get_upload_params(request: HttpRequest) -> JsonResponse:  # noqa: C901

    content_type = request.POST["type"]
    filename = get_valid_filename(request.POST["name"])
    dest = settings.S3UPLOAD_DESTINATIONS[request.POST["dest"]]

    if not dest:
        return JsonResponse({"error": "File destination does not exist."}, status=400)

    key = dest.get("key")
    auth = dest.get("auth")
    allowed_types = dest.get("allowed_types")
    acl = dest.get("acl")
    bucket = dest.get("bucket")
    cache_control = dest.get("cache_control")
    content_disposition = dest.get("content_disposition")
    content_length_range = dest.get("content_length_range")
    allowed_extensions = dest.get("allowed_extensions")
    server_side_encryption = dest.get("server_side_encryption")

    if not acl:
        acl = "public-read"

    if not key:
        return JsonResponse({"error": "Missing destination path."}, status=403)

    if auth and not auth(request.user):
        return JsonResponse({"error": "Permission denied."}, status=403)

    if (allowed_types and content_type not in allowed_types) and allowed_types != "*":
        return JsonResponse(
            {"error": "Invalid file type (%s)." % content_type}, status=400
        )

    original_ext = splitext(filename)[1]
    lowercased_ext = original_ext.lower()
    if (
        allowed_extensions and lowercased_ext not in allowed_extensions
    ) and allowed_extensions != "*":
        return JsonResponse(
            {"error": "Forbidden file extension (%s)." % original_ext}, status=415
        )

    if hasattr(key, "__call__"):
        key = key(filename)
    elif key == "/":
        key = filename
    else:
        key = "{0}/{1}".format(key, filename)

    aws_payload = create_upload_data(
        content_type=content_type,
        key=key,
        acl=acl,
        bucket=bucket,
        cache_control=cache_control,
        content_disposition=content_disposition,
        content_length_range=content_length_range,
        server_side_encryption=server_side_encryption,
    )

    url = None

    # Generate signed URL for private document access
    if acl == "private":
        url = get_signed_download_url(
            key=key.replace("${filename}", filename),
            bucket_name=bucket or settings.AWS_STORAGE_BUCKET_NAME,
            ttl=int(5 * 60),  # 5 mins
        )

    data = {
        "aws_payload": aws_payload,
        "private_access_url": url,
    }

    return JsonResponse(data, content_type="application/json")
