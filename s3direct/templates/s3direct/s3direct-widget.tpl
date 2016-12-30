<div class="s3direct" data-policy-url="{{ policy_url }}">
  <a class="file-link" target="_blank" href="{{ file_url }}">{{ file_name }}</a>
  <a class="file-remove" href="#remove">Remove</a>
  <input class="file-url" type="hidden" value="{{ file_url }}" id="{{ element_id }}" name="{{ name }}" />
  <input class="file-dest" type="hidden" value="{{ dest }}">
  <input class="file-input" type="file"  style="{{ style }}"/>
  <div class="progress progress-striped active">
    <div class="bar"></div>
  </div>
</div>
