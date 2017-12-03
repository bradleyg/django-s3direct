from django.conf.urls import include, url
from django.contrib import admin


admin.autodiscover()


urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^s3direct/', include('s3direct.urls')),
    url(r'^form/', include('cat.urls')),
]
