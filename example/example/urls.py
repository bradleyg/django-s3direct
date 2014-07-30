from django.conf.urls import patterns, include, url
from django.contrib import admin


admin.autodiscover()


urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^s3direct/', include('s3direct.urls')),
    url(r'^form/', include('cat.urls')),
)