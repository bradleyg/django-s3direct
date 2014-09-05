from django.contrib import admin

from .models import Cat, Kitten


class KittenAdminInline(admin.StackedInline):
    model = Kitten
    extra = 1


class CatAdmin(admin.ModelAdmin):
    inlines = [KittenAdminInline, ]


admin.site.register(Cat, CatAdmin)
