from django.conf.urls import patterns, url
from s3direct.views import get_upload_params

urlpatterns = patterns('',
    url('^get_upload_params/(?P<upload_to>.*)', get_upload_params, name='s3direct'),
)