from django.conf.urls import include, url
from django.contrib import admin


admin.autodiscover()


urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^s3uploads/', include('s3uploads.urls')),
    url(r'^form/', include('cat.urls')),
]
