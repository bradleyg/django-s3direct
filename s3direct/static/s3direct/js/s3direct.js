var $s3Direct = jQuery.noConflict()

$s3Direct(function(){

  var attach = function($fileInput, policy_url, el){

    $fileInput.fileupload({
      paramName: 'file',
      autoUpload: true,
      dataType: 'xml',
      add: function(e, data){
        $s3Direct(el).attr('class', 's3direct progress-active')
        
        $s3Direct.ajax({
          url: policy_url,
          type: 'POST',
          data: {type: data.files[0].type},
          success: function(fields) {
            data.url = fields.form_action
            delete fields.form_action
            data.formData = fields
            data.submit()
          }
        })
      },

      progress: function(e, data){
        var progress = parseInt(data.loaded / data.total * 100, 10)
        $s3Direct(el).find('.bar').css({width: progress + '%'})
      },

      error: function(e, data){
        alert('Oops, file upload failed, please try again')
        $s3Direct(el).attr('class', 's3direct form-active')
      },

      done: function(e, data){
        var url = $s3Direct(data.result).find('Location').text().replace(/%2F/g, '/')
        var file_name = url.replace(/^.*[\\\/]/, '')
        $s3Direct(el).find('.link').attr('href', url).text(file_name)
        $s3Direct(el).attr('class', 's3direct link-active')
        $s3Direct(el).find('input[type=hidden]').val(url)
        $s3Direct(el).find('.bar').css({width: '0%'})
      }
    })
  }

  var setup = function(el){
    var policy_url = $s3Direct(el).data('url')
    var file_url = $s3Direct(el).find('input[type=hidden]').val()
    var $fileInput = $s3Direct(el).find('input[type=file]')

    var class_ = (file_url === '') ? 'form-active' : 'link-active'
    $s3Direct(el).attr('class', 's3direct ' + class_)

    $s3Direct(el).find('.remove').click(function(e){
      e.preventDefault()
      $s3Direct(el).find('input[type=hidden]').val('')
      $s3Direct(el).attr('class', 's3direct form-active')
    })

    attach($fileInput, policy_url, el)
  }

  $s3Direct('.s3direct').each(function(i, el){
    setup(el)
  })

  $s3Direct(document).bind('DOMNodeInserted', function(e) {
    var el = $s3Direct(e.target).find('.s3direct').get(0)
    var yes = $s3Direct(el).length !== 0
    if(yes) setup(el)
  })

})