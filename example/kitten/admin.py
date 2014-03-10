from django.contrib import admin
from .models import Kitten


class KittenAdmin(admin.ModelAdmin):
    pass


admin.site.register(Kitten, KittenAdmin)
