FROM python:2.7
ENV PYTHONUNBUFFERED 1
RUN mkdir /code
COPY ./example /code/example
COPY ./s3direct /code/s3direct
WORKDIR /code/example
RUN pip install -r /code/example/requirements.txt
RUN python manage.py migrate