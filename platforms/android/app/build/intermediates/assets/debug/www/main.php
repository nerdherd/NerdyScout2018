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

      $result = mysqli_query($con, "DESCRIBE entries");
      while($row = mysqli_fetch_array($result,MYSQLI_ASSOC)) {
        echo "{$row['Field']} - {$row['Type']}";
      }
      $q = mysqli_query($con, "INSERT INTO entries (teamNumber,color,autoRating,defRating,scale,climb,speed,endScore,cards) VALUES ('$team','$color','$auto','$defense','$scale','$climb','$speed','$score','$cards')");

      if($q) {
        echo "Records inserted successfully.";
      }
      else {
        echo "ERROR: Could not execute $q" .mysqli_error($con);
      }
      // if ($q){
      //  echo "success";
      // }
      // else{
      //   echo "error";
      // }
?>
