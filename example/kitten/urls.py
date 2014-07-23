from django.conf.urls import patterns, url

from .views import MyView


urlpatterns = patterns('',
    url('', MyView.as_view(), name='form'),
)