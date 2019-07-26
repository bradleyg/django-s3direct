FROM themattrix/tox
ADD . /code
WORKDIR /code
RUN apt-get update
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs
RUN pip install -r requirements-dev.txt
RUN python setup.py develop
