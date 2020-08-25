from django.urls import path

from .views import get_upload_params

urlpatterns = [path("get_upload_params/", get_upload_params, name="s3upload")]
