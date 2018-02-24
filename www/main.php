<?php
     header("Access-Control-Allow-Origin: *");
     $con = mysqli_connect("104.197.101.9","root","nerdherd687","db");
     if(!$con){
       die('Error:'.mysqli_connect_error());
     }
      $name = $_POST['name'];
      $matchnum = $_POST['matchnum'];
      $teamnum = $_POST['teamnum'];
      $score = $_POST['score'];
      $rp = $_POST['rp'];
      $cards = $_POST['cards'];
      $autocubesource = $_POST['autocubesource'];
      $automobility = $_POST['automobility'];
      $autoswitch = $_POST['autoswitch'];
      $autoscale = $_POST['autoscale'];
      $telecubesource = $_POST['telecubesource'];
      $teledied = $_POST['teledied'];
      $teleclimb = $_POST['teleclimb'];
      $teledefense = $_POST['teledefense'];
      $teleforcetimes = $_POST['teleforcetimes'];
      $teleforcecube = $_POST['teleforcecube'];
      $teleboosttimes = $_POST['teleboosttimes'];
      $teleboostcube = $_POST['teleboostcube'];
      $telelevitatetimes = $_POST['telelevitatetimes'];
      $telelevitatecube = $_POST['telelevitatecube'];
      $telered = $_POST['telered'];
      $teleblue = $_POST['teleblue'];
      $televault = $_POST['televault'];
      $telescale = $_POST['telescale'];
      $alliance = $_POST['alliance'];
      $result = mysqli_query($con, "DESCRIBE matchScouting");
      while($row = mysqli_fetch_array($result,MYSQLI_ASSOC)) {
        echo "{$row['Field']} - {$row['Type']}";
      }
      $q = mysqli_query($con, "INSERT INTO matchScouting (name,matchnum,teamnum,score,rp,cards,autocubesource,automobility,autoswitch,autoscale,telecubesource,teledied,teleclimb,teledefense,teleforcetimes,teleforcecube,teleboosttimes,teleboostcube,telelevitatetimes,telelevitatecubes,telered,teleblue,televault,telescale,alliance) VALUES ('$name','$matchnum','$teamnum','$score','$rp','$cards','$autocubesource','$automobility','$autoswitch','$autoscale', '$telecubesource','$teledied','$teleclimb','$teledefense','$teleforcetimes','$teleforcecube','$teleboosttimes','$teleboostcube','$telelevitatetimes','$telelevitatecube','$telered','$teleblue','$televault','$telescale','$alliance')");

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
