<div class="s3uploads" data-policy-url="{{ policy_url }}">
  <a class="s3uploads__file-link" target="_blank" href="{{ file_url }}">{{ file_name }}</a>
  <a class="s3uploads__file-remove" href="#remove">Remove</a>
  <input class="s3uploads__file-url" type="hidden" value="{{ file_url }}" id="{{ element_id }}" name="{{ name }}" />
  <input class="s3uploads__file-dest" type="hidden" value="{{ dest }}">
  <input class="s3uploads__file-input" type="file"  style="{{ style }}"/>
  <div class="s3uploads__error"></div>
  <div class="s3uploads__progress active">
    <div class="s3uploads__bar"></div>
  </div>
</div>
