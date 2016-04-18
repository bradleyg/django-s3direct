from django.conf.urls import patterns, url

from .views import MyView


urlpatterns = [
    url('', MyView.as_view(), name='form'),
]
