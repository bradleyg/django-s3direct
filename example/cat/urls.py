from django.conf.urls import url

from .views import MyView, MultiForm


urlpatterns = [
    url(r'^multi/$', MultiForm.as_view(), name='multi_form'),
    url('', MyView.as_view(), name='form'),
]
