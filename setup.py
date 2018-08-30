import os
from setuptools import setup

f = open(os.path.join(os.path.dirname(__file__), 'README.md'))
readme = f.read()
f.close()

setup(
    name='django-s3-upload',
    version='0.2.1',
    description=('Add direct uploads to S3 to file input fields.'),
    long_description=readme,
    author="YunoJuno",
    author_email='code@yunojuno.com',
    url='https://github.com/yunojuno/django-s3-upload',
    packages=['s3upload'],
    include_package_data=True,
    install_requires=['django>=1.11', 'boto3'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Framework :: Django :: 1.11',
        'Framework :: Django :: 2.0',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3.6',
    ],
)
