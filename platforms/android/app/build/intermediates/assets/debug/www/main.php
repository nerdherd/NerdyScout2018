<?php
  include "db.php";
  if (isset($_POST['insert'])) {
      $team = $_POST['team'];
      $color = $_POST['color'];
      $auto = $_POST['auto'];
      $defense = $_POST['defense'];
      $scale = $_POST['scale'];
      $climb = $_POST['climb'];
      $speed = $_POST['speed'];
      $score = $_POST['score'];
      $cards = $_POST['cards'];

      $q = mysqli_query($con, "INSERT INTO `entries` (`team`,`color`,`auto`,'defense','scale','score','cards') VALUES (`$team`,`$color`,`$auto`,'$defense','$scale','$score','$cards')");
      if ($q) echo "success";
      else echo "error";
  }
?>
