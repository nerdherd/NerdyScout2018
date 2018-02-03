<?php
     header("Access-Control-Allow-Origin: *");
     $con = mysqli_connect("104.197.101.9","root","","db");
     if(!$con){
       die('Error:'.mysqli_connect_error());
     }
      $team = $_POST['team'];
      $color = $_POST['color'];
      $auto = $_POST['auto'];
      $defense = $_POST['defense'];
      $scale = $_POST['scale'];
      $climb = $_POST['climb'];
      $speed = $_POST['speed'];
      $score = $_POST['score'];
      $cards = $_POST['cards'];

      $q = mysqli_query($con, "INSERT INTO entries (team,color,auto,defense,scale,score,cards) VALUES ('$team','$color','$auto','$defense','$scale','$score','$cards')");
      if(mysqli_query($con, $q)) {
        echo "Records inserted successfully.";
      }
      else {
        echo "ERROR: Could not able to execute $q" .mysqli_error($con);
      }
      // if ($q){
      //  echo "success";
      // }
      // else{
      //   echo "error";
      // }
?>
