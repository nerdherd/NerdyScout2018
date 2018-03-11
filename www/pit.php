<?php
     header("Access-Control-Allow-Origin: *");
     $con = mysqli_connect("104.197.101.9","root","nerdherd687","db");
     if(!$con){
       die('Error:'.mysqli_connect_error());
     }
     $pitgroup=$_POST["pitgroup"];
     $pitteam=$_POST["pitteam"];
     $pitauto=$_POST["pitauto"];
     $pitautoabilities=$_POST["pitautoabilities"];
     $pitteleop=$_POST["pitteleop"];
     $pitintake=$_POST["pitintake"];
     $pitscore=$_POST["pitscore"];
     $pitclimb=$_POST["pitclimb"];
     $pitimage=$_POST["pitimage"];

      $result = mysqli_query($con, "DESCRIBE pitSCouting");
      while($row = mysqli_fetch_array($result,MYSQLI_ASSOC)) {
        echo "{$row['Field']} - {$row['Type']}";
      }
      $q = mysqli_query($con, "INSERT INTO pitScouting (pitgroup,pitteam,pitauto,pitautoabilities,pitteleop,pitintake,pitscore,pitclimb, pitimage) VALUES ('pitgroup','pitteam','pitauto','pitautoabilities','pitteleop','pitintake','pitscore','pitclimb','pitimage')");

      if($q) {
        echo "Records inserted successfully.";
      }
      else {
        echo "ERROR: Could not execute $q" .mysqli_error($con);
      }

?>
