import Cookies from "js-cookie";
import createHash from "sha.js";
import Evaporate from "evaporate";
import SparkMD5 from "spark-md5";

import "./css/bootstrap-progress.css";
import "./css/styles.css";

const request = (method, url, data, headers, el, cb) => {
  let req = new XMLHttpRequest();
  req.open(method, url, true);

  Object.keys(headers).forEach((key) => {
    req.setRequestHeader(key, headers[key]);
  });

  req.onload = () => {
    cb(req.status, req.responseText);
  };

  req.onerror = req.onabort = () => {
    disableSubmit(false);
    error(el, "Sorry, failed to upload file.");
  };

  req.send(data);
};

const parseNameFromUrl = (url) => {
  return decodeURIComponent((url + "").replace(/\+/g, "%20"));
};

const parseJson = (json) => {
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    data = null;
  }
  return data;
};

const updateProgressBar = (element, progressRatio) => {
  const bar = element.querySelector(".bar");
  bar.style.width = Math.round(progressRatio * 100) + "%";
};

const error = (el, msg) => {
  el.className = "s3direct form-active";
  el.querySelector(".file-input").value = "";
  alert(msg);
};

let concurrentUploads = 0;

const disableSubmit = (status) => {
  const submitRow = document.querySelector(".submit-row");
  if (!submitRow) return;

  const buttons = submitRow.querySelectorAll(
    "input[type=submit],button[type=submit]"
  );

  if (status === true) concurrentUploads++;
  else concurrentUploads--;

  [].forEach.call(buttons, (el) => {
    el.disabled = concurrentUploads !== 0;
  });
};

const finishUpload = (element, endpoint, bucket, objectKey) => {
  const link = element.querySelector(".file-link");
  const url = element.querySelector(".file-url");
  url.value = endpoint + "/" + bucket + "/" + objectKey;
  link.setAttribute("href", url.value);
  link.innerHTML = parseNameFromUrl(url.value).split("/").pop();
  element.className = "s3direct link-active";
  element.querySelector(".bar").style.width = "0%";
  disableSubmit(false);
};

const computeMd5 = (data) => {
  return btoa(SparkMD5.ArrayBuffer.hash(data, true));
};

const computeSha256 = (data) => {
  return createHash("sha256").update(data, "utf-8").digest("hex");
};

const getCsrfToken = (element) => {
  const cookieInput = element.querySelector(".csrf-cookie-name");
  const input = document.querySelector("input[name=csrfmiddlewaretoken]");
  const token = input ? input.value : Cookies.get(cookieInput.value);
  return token;
};

const generateAmzInitHeaders = (acl, serverSideEncryption, sessionToken) => {
  const headers = {};
  if (acl) headers["x-amz-acl"] = acl;
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;
  if (serverSideEncryption) {
    headers["x-amz-server-side-encryption"] = serverSideEncryption;
  }
  return headers;
};

const generateAmzCommonHeaders = (sessionToken) => {
  const headers = {};
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;
  return headers;
};

const generateCustomAuthMethod = (element, signingUrl, dest) => {
  const getAwsV4Signature = (
    _signParams,
    _signHeaders,
    stringToSign,
    signatureDateTime,
    _canonicalRequest
  ) => {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      const headers = { "X-CSRFToken": getCsrfToken(element) };

      form.append("to_sign", stringToSign);
      form.append("datetime", signatureDateTime);
      form.append("dest", dest);

      request("POST", signingUrl, form, headers, element, (status, resp) => {
        const response = parseJson(resp);
        switch (status) {
          case 200:
            resolve(response.s3ObjKey);
            break;
          case 403:
          default:
            reject(response.error);
            break;
        }
      });
    });
  };

  return getAwsV4Signature;
};

const initiateUpload = (element, signingUrl, uploadParameters, file, dest) => {
  const createConfig = {
    customAuthMethod: generateCustomAuthMethod(element, signingUrl, dest),
    aws_key: uploadParameters.access_key_id,
    bucket: uploadParameters.bucket,
    aws_url: uploadParameters.endpoint,
    awsRegion: uploadParameters.region,
    computeContentMd5: true,
    cryptoMd5Method: computeMd5,
    cryptoHexEncodedHash256: computeSha256,
    partSize: 20 * 1024 * 1024,
    logging: true,
    allowS3ExistenceOptimization: uploadParameters.allow_existence_optimization,
    s3FileCacheHoursAgo: uploadParameters.allow_existence_optimization ? 12 : 0,
  };

  const addConfig = {
    name: uploadParameters.object_key,
    file: file,
    contentType: file.type,
    xAmzHeadersCommon: generateAmzCommonHeaders(uploadParameters.session_token),
    xAmzHeadersAtInitiate: generateAmzInitHeaders(
      uploadParameters.acl,
      uploadParameters.server_side_encryption,
      uploadParameters.session_token
    ),
    progress: (progressRatio, stats) => {
      updateProgressBar(element, progressRatio);
    },
    warn: (warnType, area, msg) => {
      if (msg.includes("InvalidAccessKeyId")) {
        error(element, msg);
      }
    },
  };

  const optHeaders = {};

  if (uploadParameters.cache_control) {
    optHeaders["Cache-Control"] = uploadParameters.cache_control;
  }

  if (uploadParameters.content_disposition) {
    optHeaders["Content-Disposition"] = uploadParameters.content_disposition;
  }

  addConfig["notSignedHeadersAtInitiate"] = optHeaders;

  Evaporate.create(createConfig).then((evaporate) => {
    disableSubmit(true);

    element.className = "s3direct progress-active";

    const cancelButton = element.querySelector(".cancel-button");

    const cancelUpload = (e) => {
      e.preventDefault();
      evaporate.cancel(`${uploadParameters.bucket}/${addConfig.name}`);
    };

    cancelButton.addEventListener("click", cancelUpload, false);

    evaporate.add(addConfig).then(
      (s3Objkey) => {
        cancelButton.removeEventListener("click", cancelUpload);
        finishUpload(
          element,
          uploadParameters.endpoint,
          uploadParameters.bucket,
          s3Objkey
        );
      },
      (reason) => {
        cancelButton.removeEventListener("click", cancelUpload);
        return error(element, reason);
      }
    );
  });
};

const checkFileAndInitiateUpload = (event) => {
  const element = event.target.parentElement;
  const file = element.querySelector(".file-input").files[0];
  const dest = element.querySelector(".file-dest").value;
  const destCheckUrl = element.getAttribute("data-policy-url");
  const signerUrl = element.getAttribute("data-signing-url");
  const form = new FormData();
  const headers = { "X-CSRFToken": getCsrfToken(element) };

  form.append("dest", dest);
  form.append("name", file.name);
  form.append("type", file.type);
  form.append("size", file.size);

  request("POST", destCheckUrl, form, headers, element, (status, response) => {
    const uploadParameters = parseJson(response);
    switch (status) {
      case 200:
        initiateUpload(element, signerUrl, uploadParameters, file, dest);
        break;
      case 400:
      case 403:
      case 500:
        error(element, uploadParameters.error);
        break;
      default:
        error(element, "Sorry, could not get upload URL.");
    }
  });
};

const removeUpload = (e) => {
  e.preventDefault();
  const el = e.target.parentElement;
  el.querySelector(".file-url").value = "";
  el.querySelector(".file-input").value = "";
  el.className = "s3direct form-active";
};

const addHandlers = (el) => {
  const url = el.querySelector(".file-url");
  if (url.name.includes("__prefix__")) return false;

  const input = el.querySelector(".file-input");
  const remove = el.querySelector(".file-remove");
  const status = url.value === "" ? "form" : "link";

  el.className = "s3direct " + status + "-active";
  remove.addEventListener("click", removeUpload, false);
  input.addEventListener("change", checkFileAndInitiateUpload, false);
};

const findAndAddHandlers = () => {
  document
    .querySelectorAll(".s3direct:not(.form-active, .link-active)")
    .forEach(addHandlers);
};

document.addEventListener("DOMContentLoaded", (event) => {
  findAndAddHandlers();

  const observer = new MutationObserver(() => findAndAddHandlers());

  observer.observe(document.body, { childList: true, subtree: true });
});
