from django.conf.urls import url

from .views import MyView


urlpatterns = [
    url('', MyView.as_view(), name='form'),
]
