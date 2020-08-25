from django.urls import path

from .views import AsyncForm, MultiForm, MyView

app_name = "cat"

urlpatterns = [
    path("async/", AsyncForm.as_view(), name="async_form"),
    path("multi/", MultiForm.as_view(), name="multi_form"),
    path("", MyView.as_view(), name="form"),
]
