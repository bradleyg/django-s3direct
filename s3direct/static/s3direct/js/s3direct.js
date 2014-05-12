$(function(){

  var attach = function($fileInput, policy_url, el){

    var $el = $(el);

    $fileInput.fileupload({
      paramName: 'file',
      autoUpload: true,
      dataType: 'xml',
      add: function(e, data){
        $(".submit-row input[type=submit]").prop('disabled', true);
        $el.attr('class', 's3direct progress-active');

        $.ajax({
          url: policy_url,
          type: 'POST',
          data: {
            type: data.files[0].type,
            name: data.files[0].name
          },
          success: function(fields) {
            data.url = fields.form_action;
            delete fields.form_action;
            data.formData = fields;
            data.submit()
          }
        })
      },

      progress: function(e, data){
        var progress = parseInt(data.loaded / data.total * 100, 10);
        $el.find('.bar').css({width: progress + '%'})
      },

      error: function(e, data){
        alert('Oops, file upload failed, please try again');
        $el.attr('class', 's3direct form-active')
      },

      done: function(e, data){
        var url = $(data.result).find('Location').text().replace(/%2F/g, '/');
        var file_name = url.replace(/^.*[\\\/]/, '');
        $el.find('.link').attr('href', url).text(file_name);
        $el.attr('class', 's3direct link-active');
        $el.find('input[type=hidden]').val(url);
        $el.find('.bar').css({width: '0%'});
        $(".submit-row input[type=submit]").prop('disabled', false)
      }
    })
  }

  var setup = function(el){
    var $el = $(el);

    var policy_url = $el.data('url');
    var file_url = $el.find('input[type=hidden]').val();
    var $fileInput = $el.find('input[type=file]')

    var class_ = (file_url === '') ? 'form-active' : 'link-active'
    $el.attr('class', 's3direct ' + class_)

    $el.find('.remove').click(function(e){
      e.preventDefault()
      $el.find('input[type=hidden]').val('')
      $el.attr('class', 's3direct form-active')
    })

    attach($fileInput, policy_url, el)
  }

  $('.s3direct').each(function(i, el){
    setup(el)
  })

  $(document).bind('DOMNodeInserted', function(e) {
    var el = $(e.target).find('.s3direct').get(0)
    var yes = $(el).length !== 0
    if(yes) setup(el)
  })

})