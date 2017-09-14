from django.conf.urls import url

from .views import MyView, MultiForm, AsyncForm


urlpatterns = [
    url(r'^async/$', AsyncForm.as_view(), name='async_form'),
    url(r'^multi/$', MultiForm.as_view(), name='multi_form'),
    url('', MyView.as_view(), name='form'),
]
