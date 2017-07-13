from django.conf.urls import url
from s3uploads.views import get_upload_params

urlpatterns = [
    url('^get_upload_params/', get_upload_params, name='s3uploads')
]
