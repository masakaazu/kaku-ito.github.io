#!/usr/bin/perl
# 教材ページの色を「チャコール×クリーム」の夜テーマへ機械変換する
#   - 明るさ(L*)を反転：白い背景→チャコール、濃い文字→クリーム
#   - 青・紫・シアン・グレー（ブランド色）→ クリーム系の無彩色へ
#   - 赤・橙・黄・緑（正誤や注意の意味を持つ色）→ 色相を残して彩度を落とす
#   - 影は黒のまま
# 使い方: perl tools/darken.pl 教材.html ...   （上書き。--dry で件数のみ）
# 変換済みのページには <meta name="color-scheme" content="dark"> が入り、2回目以降は自動で飛ばす。
use strict; use warnings; use POSIX qw(floor);

my $DRY = 0;
@ARGV = grep { $_ eq '--dry' ? ($DRY = 1, 0) : 1 } @ARGV;

my $CREAM_HUE = 85;

# ---------- 色空間 ----------
sub s2l { my $c = shift; $c <= 0.04045 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4 }
sub l2s { my $c = shift; $c <= 0.0031308 ? 12.92 * $c : 1.055 * ($c ** (1 / 2.4)) - 0.055 }
sub fxyz { my $t = shift; $t > 216 / 24389 ? $t ** (1 / 3) : (24389 / 27 * $t + 16) / 116 }
sub fxyz_inv { my $t = shift; $t ** 3 > 216 / 24389 ? $t ** 3 : (116 * $t - 16) / (24389 / 27) }

sub rgb2lch {
  my ($r, $g, $b) = map { s2l($_ / 255) } @_;
  my $x = 0.4124564 * $r + 0.3575761 * $g + 0.1804375 * $b;
  my $y = 0.2126729 * $r + 0.7151522 * $g + 0.0721750 * $b;
  my $z = 0.0193339 * $r + 0.1191920 * $g + 0.9503041 * $b;
  my ($fx, $fy, $fz) = (fxyz($x / 0.95047), fxyz($y), fxyz($z / 1.08883));
  my ($L, $A, $B) = (116 * $fy - 16, 500 * ($fx - $fy), 200 * ($fy - $fz));
  my $C = sqrt($A * $A + $B * $B);
  my $h = atan2($B, $A) * 180 / 3.14159265358979;
  $h += 360 if $h < 0;
  return ($L, $C, $h);
}

sub lch2rgb_raw {
  my ($L, $C, $h) = @_;
  my $hr = $h * 3.14159265358979 / 180;
  my ($A, $B) = ($C * cos($hr), $C * sin($hr));
  my $fy = ($L + 16) / 116;
  my ($fx, $fz) = ($fy + $A / 500, $fy - $B / 200);
  my ($x, $y, $z) = (fxyz_inv($fx) * 0.95047, ($L > 8 ? $fy ** 3 : $L / (24389 / 27)), fxyz_inv($fz) * 1.08883);
  my $r = 3.2404542 * $x - 1.5371385 * $y - 0.4985314 * $z;
  my $g = -0.9692660 * $x + 1.8760108 * $y + 0.0415560 * $z;
  my $b = 0.0556434 * $x - 0.2040259 * $y + 1.0572252 * $z;
  return map { l2s($_) } ($r, $g, $b);
}

sub lch2rgb {
  my ($L, $C, $h) = @_;
  for (1 .. 60) {   # sRGB に入るまで彩度を落とす
    my @c = lch2rgb_raw($L, $C, $h);
    return map { my $v = floor($_ * 255 + 0.5); $v < 0 ? 0 : $v > 255 ? 255 : $v } @c
      if !grep { $_ < -0.001 || $_ > 1.001 } @c;
    $C *= 0.9;
  }
  return map { my $v = floor($_ * 255 + 0.5); $v < 0 ? 0 : $v > 255 ? 255 : $v } lch2rgb_raw($L, 0, $h);
}

# ---------- 変換規則 ----------
sub map_lightness {
  my ($L, $mode) = @_;
  return 15.5 if $L >= 99.5;            # 白（カード）→ 背景よりわずかに明るい面
  return 12.3 if $L >= 95;              # ほぼ白（ページ背景）→ チャコール
  my $out = 11 + 80 * ((1 - $L / 100) ** 0.7);
  $out = 62 if $mode eq 'text' && $L < 75 && $out < 62;   # 文字は暗い背景で読める明るさを保つ
  return $out;
}

sub is_semantic {   # 意味を持つ色相（赤・橙・黄・緑）
  my ($C, $h) = @_;
  return 0 if $C < 10;
  return ($h < 105 || $h >= 335 || ($h >= 105 && $h < 170)) ? 1 : 0;
}

sub convert_rgb {
  my ($r, $g, $b, $mode) = @_;
  my ($L, $C, $h) = rgb2lch($r, $g, $b);
  return (30, 31, 33) if $L >= 95 && $L < 99.5 && $C < 6;   # ページ背景はサイト共通の #1e1f21
  my $L2 = map_lightness($L, $mode);
  my ($C2, $h2);
  if (is_semantic($C, $h)) {
    ($C2, $h2) = ($C * 0.5, $h);
    $C2 = 26 if $C2 > 26;
  } else {
    # 暗い色はほぼ無彩色、明るい色ほどクリームの暖かみを持たせる
    ($C2, $h2) = (0.4 + (($L2 / 90) ** 2) * 6 + ($C > 60 ? 60 : $C) * 0.02, $CREAM_HUE);
  }
  return lch2rgb($L2, $C2, $h2);
}

my %stats;

sub convert_color {
  my ($tok, $mode) = @_;
  my ($r, $g, $b, $a, $fmt);
  if ($tok =~ /^#([0-9a-f]{3,8})$/i) {
    my $hex = $1;
    if (length $hex == 3 || length $hex == 4) { $hex = join '', map { $_ x 2 } split //, $hex }
    return $tok unless length $hex == 6 || length $hex == 8;
    ($r, $g, $b) = map { hex } unpack '(A2)3', $hex;
    $a = length $hex == 8 ? hex(substr $hex, 6, 2) / 255 : 1;
    $fmt = length $hex == 8 ? 'hex8' : 'hex';
  } elsif ($tok =~ /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/i) {
    ($r, $g, $b) = ($1, $2, $3);
    $a = defined $4 ? ($4 =~ /%$/ ? $4 / 100 : $4) : 1;
    $fmt = 'rgba';
  } elsif ($tok =~ /^(white|black)$/i) {
    ($r, $g, $b) = lc $tok eq 'white' ? (255, 255, 255) : (0, 0, 0);
    ($a, $fmt) = (1, 'hex');
  } else {
    return $tok;
  }
  $stats{colors}++;
  # 半透明の暗い背景（モーダルの幕など）は「暗くする」用途なので反転しない
  if ($mode eq "surface" && $a < 1) {
    my ($L) = rgb2lch($r, $g, $b);
    if ($L < 35) { my $a2 = $a * 1.3; $a2 = 0.75 if $a2 > 0.75; return sprintf("rgba(0, 0, 0, %s)", 0 + sprintf("%.3f", $a2)); }
  }
  my @n = $mode eq 'shadow' ? (0, 0, 0) : convert_rgb($r, $g, $b, $mode);
  if ($mode eq 'shadow') { $a = $a * 2.2; $a = 0.6 if $a > 0.6 }
  if ($fmt eq 'rgba' || ($fmt eq 'hex8')) {
    return sprintf '#%02x%02x%02x%02x', @n, floor($a * 255 + 0.5) if $fmt eq 'hex8';
    return $a == 1 ? sprintf('rgb(%d, %d, %d)', @n) : sprintf('rgba(%d, %d, %d, %s)', @n, 0 + sprintf('%.3f', $a));
  }
  return sprintf '#%02x%02x%02x', @n;
}

my $COLOR_RE = qr/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|(?<![-\w])(?:white|black)(?![-\w])/;

sub mode_of_prop {
  my $p = lc shift;
  return 'text'    if $p =~ /^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color|accent-color)$/;
  return 'shadow'  if $p =~ /shadow$/;
  return 'line'    if $p =~ /^(border|outline|column-rule)/;
  return 'surface' if $p =~ /^background/;
  return 'other';
}

sub convert_value {
  my ($value, $mode) = @_;
  # 値に長さ＋色が並ぶ変数（--shadow など）は影として扱う
  $mode = 'shadow' if $mode eq 'var' && $value =~ /\d+px/ && $value =~ $COLOR_RE && $value !~ /gradient/;
  $mode = 'surface' if $mode eq 'var' || $mode eq 'other';
  $value =~ s/($COLOR_RE)/convert_color($1, $mode)/ge;
  return $value;
}

# CSS 本文を変換（変数は使われ方から役割を推定する）
sub convert_css {
  my $css = shift;
  my %role;
  while ($css =~ /([-\w]+)\s*:\s*([^;{}]+)/g) {
    my ($p, $v) = ($1, $2);
    my $m = mode_of_prop($p);
    $role{$_}{$m}++ for $v =~ /var\(\s*(--[-\w]+)/g;
  }
  $css =~ s{([-\w]+)(\s*:\s*)([^;{}]+)}{
    my ($p, $sep, $v) = ($1, $2, $3);
    my $mode;
    if ($p =~ /^--/) {
      my $r = $role{$p} || {};
      my @used = grep { $_ ne 'other' } keys %$r;
      $mode = (@used == 1 && $used[0] eq 'text') ? 'text'
            : (@used == 1 && $used[0] eq 'shadow') ? 'shadow'
            : 'var';
    } else {
      $mode = mode_of_prop($p);
    }
    $p . $sep . convert_value($v, $mode);
  }ge;
  return $css;
}

# JS 内の色（WBS のメッセージ色・テンプレート内の style 属性）
sub convert_js {
  my $js = shift;
  $js =~ s{(\.style\.(\w+)\s*=\s*["'])($COLOR_RE)}{$1 . convert_color($3, mode_of_prop($2 eq 'backgroundColor' ? 'background' : $2))}ge;
  return $js;
}

for my $f (@ARGV) {
  open my $in, '<:raw', $f or die "$f: $!";
  my $s = do { local $/; <$in> };
  close $in;
  if ($s =~ /<meta name="color-scheme" content="dark">/) {
    printf "%-36s skip (変換済み)\n", $f;
    next;
  }
  %stats = ();
  $s =~ s{(<style[^>]*>)(.*?)(</style>)}{$1 . convert_css($2) . $3}gse;
  $s =~ s{(<[a-zA-Z][^>]*?\sstyle=")([^"]*)(")}{$1 . convert_css($2) . $3}ge;
  $s =~ s{(<script>)(.*?)(</script>)}{$1 . convert_js($2) . $3}gse;
  # 変換済みの目印（2回目以降の実行で二重に変換しないため）
  $s =~ s{(<meta charset="?[^">]*"?\s*/?>)}{$1\n  <meta name="color-scheme" content="dark">}i
    or warn "$f: <meta charset> がないため変換済みの目印を付けられません\n";
  printf "%-36s %4d colors\n", $f, $stats{colors} || 0;
  next if $DRY;
  open my $out, '>:raw', $f or die;
  print $out $s;
  close $out;
}
1;
