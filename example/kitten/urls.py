from django.conf.urls import patterns, url

from .views import IndexView

urlpatterns = patterns('',
    url('', IndexView.as_view(), name='form'),
)