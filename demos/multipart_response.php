<?php

function generate_part($data,$type="plain/text",$showLength=false) {
	$str = sprintf("!!!!!!=_NextPart_%d",+mt_rand());
	if ($type) $str .= sprintf("\nContent-Type: %s",$type);
	if ($showLength) $str .= sprintf("\nContent-Length: %d",strlen($data));
	
	return $str."\n\n".$data."\n";
}

?>