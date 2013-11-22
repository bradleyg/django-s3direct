import os
from setuptools import setup

f = open(os.path.join(os.path.dirname(__file__), 'README.md'))
readme = f.read()
f.close()

setup(
    name='django-s3direct',
    version='0.1.2',
    description='Add direct uploads to S3 functionality with a progress bar to file input fields within Django admin.',
    long_description=readme,
    author="Bradley Griffiths",
    author_email='bradley.griffiths@gmail.com',
    url='https://github.com/bradleyg/django-s3direct',
    packages=['s3direct'],
    include_package_data=True,
    install_requires=['setuptools'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Web Environment',
        'Framework :: Django',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: BSD License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
    ],
)
