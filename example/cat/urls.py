from django.conf.urls import url

from .views import MyView, MultiForm, AsyncForm

app_name = 'cat'

urlpatterns = [
    url('^async/$', AsyncForm.as_view(), name='async_form'),
    url('^multi/$', MultiForm.as_view(), name='multi_form'),
    url('', MyView.as_view(), name='form'),
]
