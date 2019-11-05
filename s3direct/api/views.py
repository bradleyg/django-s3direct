from rest_framework.views import APIView

from ..api import serializers, utils


class S3DirectWrapper(APIView):
    """Custom s3direct `get_params` method

    It calls own (overridden) s3direct functions.

    This view allows to get request params as JSON instead of form-data and add
    custom policy expiration time and key equal condition to policy
    """

    def post(self, request):
        """Wrapper method to get upload params for AWS S3 file upload"""
        serializer = serializers.S3DirectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return utils.get_upload_params(request=request, **serializer.data)
