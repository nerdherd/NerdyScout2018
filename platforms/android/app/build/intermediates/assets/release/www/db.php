<?php
 header("Access-Control-Allow-Origin: *");
 $con = mysqli_connect("104.197.101.9","root","","db");
 if(!$con){
   die('Error:'.mysqli_connect_error());
 }
?>
