/*! mpAjax (multi-part Ajax responses)
	v0.3.4 (c) Kyle Simpson
	MIT License
*/

The concept behind mpAjax is to extend the frameworks' Ajax functionality
so that it can parse an Ajax response formatted as multi-part, sending
each part to a separate response handler. 

The motivation is that many Ajax requests require multiple types of content
(like some JSON, some HTML, and some CSS), and it's inefficient to convert
or represent any of those text formats as one of the other formats. By the 
server simply sending back multiple parts, one for each type of content 
appropriate for the response, the client-side JavaScript can simply listen
for each response part with a separate handler appropriate to that type of
content, simplifying code and improving efficiency of transfer.

mpAjax is "backwards-compatible", meaning that Ajax responses which are not
multi-part formatted will transparently pass through as normal Ajax response
handling. Only an Ajax response that is multi-part formatted will be parsed
and separated.

A multi-part response might look like this:


    !!!!!!=_NextPart_411426488
    Content-Type: text/html
 
    <div>Hello, I'm some HTML markup, and I can use " characters natively 
		with no problems.</div>
 

    !!!!!!=_NextPart_2106560908
    Content-Type: application/json
 
    {"greeting":"Hello","name":"I'm JSON, natively without any 
		transformations or escaping!"}


And to set up response handlers for each "part" of this response, the code
(for jQuery) might look this:


    jQuery.get(
       "http://some.tld/something",
       {
          "text/html": handle_html,
          "application/json": handle_json
       }
    );
    
