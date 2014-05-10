#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
from setuptools import setup, Command

f = open(os.path.join(os.path.dirname(__file__), 'README.md'))
readme = f.read()
f.close()


class PyTest(Command):
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        import sys
        import subprocess

        exit_code = subprocess.call([sys.executable, 'runtests.py'])
        raise SystemExit(exit_code)


setup(
    name='django-s3direct',
    version='0.1.10',
    description='Add direct uploads to S3 functionality with a progress bar to file input fields within Django admin.',
    long_description=readme,
    author="Bradley Griffiths",
    author_email='bradley.griffiths@gmail.com',
    url='https://github.com/bradleyg/django-s3direct',
    packages=['s3direct'],
    include_package_data=True,
    install_requires=['django>=1.5.1', 'django-storages>=1.1', 'django-appconf>=0.6'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
    ],
    cmdclass={'test': PyTest},
)
