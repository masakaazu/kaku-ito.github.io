#!/usr/bin/perl
# 夜テーマに変換済みの教材ページ（darken.pl の出力）を、サイト共通の明るいデザインへ戻す
#   - 無彩色（チャコール・クリーム系）→ 明るさを反転した純粋なグレー
#       ページ背景 → 白、カードの面 → 薄いグレー(#f5f5f7)、文字 → ほぼ黒
#   - 教材のブランド色（夜テーマでグレーになっていたもの）→ サイトのアクセント色（青）
#   - 赤・橙・黄・緑（正誤や注意の意味を持つ色）→ theme.css と同じ意味の色
#   - 影は黒のまま、薄くする
# 色は light-dark(明るい色, 元の暗い色) の形で書くので、theme.css の color-scheme を
# dark に変えると元の夜テーマに戻る。
# 使い方: perl tools/lighten.pl 教材.html ...   （上書き。--dry で件数のみ）
use strict; use warnings; use POSIX qw(floor);

my $DRY = 0;
@ARGV = grep { $_ eq '--dry' ? ($DRY = 1, 0) : 1 } @ARGV;

# ---------- 色空間（CIE LCh） ----------
sub s2l { my $c = shift; $c <= 0.04045 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4 }
sub l2s { my $c = shift; $c <= 0.0031308 ? 12.92 * $c : 1.055 * ($c ** (1 / 2.4)) - 0.055 }
sub fxyz { my $t = shift; $t > 216 / 24389 ? $t ** (1 / 3) : (24389 / 27 * $t + 16) / 116 }

sub rgb2lch {
  my ($r, $g, $b) = map { s2l($_ / 255) } @_;
  my $x = 0.4124564 * $r + 0.3575761 * $g + 0.1804375 * $b;
  my $y = 0.2126729 * $r + 0.7151522 * $g + 0.0721750 * $b;
  my $z = 0.0193339 * $r + 0.1191920 * $g + 0.9503041 * $b;
  my ($fx, $fy, $fz) = (fxyz($x / 0.95047), fxyz($y), fxyz($z / 1.08883));
  my ($L, $A, $B) = (116 * $fy - 16, 500 * ($fx - $fy), 200 * ($fy - $fz));
  my $h = atan2($B, $A) * 180 / 3.14159265358979;
  $h += 360 if $h < 0;
  return ($L, sqrt($A * $A + $B * $B), $h);
}

# 明るさ L* の無彩色（グレー）
sub gray {
  my $L = shift;
  my $y = $L > 8 ? (($L + 16) / 116) ** 3 : $L / (24389 / 27);
  my $v = floor(l2s($y) * 255 + 0.5);
  $v = 0 if $v < 0; $v = 255 if $v > 255;
  return ($v, $v, $v);
}

# theme.css と同じ色（明るいとき）
my %SEMANTIC = (
  good => '#248a3d', 'good-bg' => '#e8f6ec',
  bad  => '#d70015', 'bad-bg'  => '#fdecee',
  warn => '#b25000', 'warn-bg' => '#fff4e5',
);
my $ACCENT = '#0071e3';
my $ACCENT_SOFT = '#e8f1fc';   # アクセントの薄い面（選択中のタブの背景など）
# 夜テーマでブランド色（元は青・紫）だったグレー
my %BRAND = map { $_ => 1 } qw(9d9890 9f9a93 a9a49c);

my %stats;

sub light_of {
  my ($r, $g, $b, $a, $mode) = @_;
  my $hex = sprintf '%02x%02x%02x', $r, $g, $b;
  return $ACCENT if $BRAND{$hex} && $a == 1;
  my ($L, $C, $h) = rgb2lch($r, $g, $b);
  if ($C >= 10) {   # 意味を持つ色
    my $kind = ($h >= 105 && $h < 200) ? 'good' : ($h >= 50 && $h < 105) ? 'warn' : 'bad';
    return $SEMANTIC{$L < 32 ? "$kind-bg" : $kind};
  }
  return '#ffffff' if $L <= 13.5;                       # ページの背景
  return '#f5f5f7' if $L <= 17.5;                       # カードの面
  my $t = ($L - 11) / 80; $t = 0 if $t < 0; $t = 1 if $t > 1;
  my $L2 = 100 * (1 - $t ** (1 / 0.7));
  $L2 = 98 if $L2 > 98 && $mode eq 'surface';
  $L2 = 11 if $L2 < 11;                                 # 文字のいちばん濃い色 ≒ #1d1d1f
  return sprintf '#%02x%02x%02x', gray($L2);
}

sub convert_color {
  my ($tok, $mode) = @_;
  my ($r, $g, $b, $a, $fmt);
  if ($tok =~ /^#([0-9a-f]{3,8})$/i) {
    my $hex = $1;
    if (length $hex == 3 || length $hex == 4) { $hex = join '', map { $_ x 2 } split //, $hex }
    return $tok unless length $hex == 6 || length $hex == 8;
    ($r, $g, $b) = map { hex } unpack '(A2)3', $hex;
    $a = length $hex == 8 ? hex(substr $hex, 6, 2) / 255 : 1;
  } elsif ($tok =~ /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/i) {
    ($r, $g, $b) = ($1, $2, $3);
    $a = defined $4 ? ($4 =~ /%$/ ? $4 / 100 : $4) : 1;
  } elsif ($tok =~ /^(white|black)$/i) {
    ($r, $g, $b) = lc $tok eq 'white' ? (255, 255, 255) : (0, 0, 0);
    $a = 1;
  } else {
    return $tok;
  }
  $stats{colors}++;
  my $light;
  my ($L) = rgb2lch($r, $g, $b);
  if ($a < 1 && ($mode eq 'shadow' || $L < 8)) {
    # 影・暗い幕は黒のまま薄く
    $light = sprintf 'rgba(0, 0, 0, %s)', 0 + sprintf('%.3f', $a * ($mode eq 'shadow' ? 0.35 : 0.6));
  } else {
    $light = light_of($r, $g, $b, $a, $mode);
    if ($a < 1) {
      my ($lr, $lg, $lb) = map { hex } unpack '(A2)3', substr($light, 1);
      $light = sprintf 'rgba(%d, %d, %d, %s)', $lr, $lg, $lb, 0 + sprintf('%.3f', $a);
    }
  }
  return "light-dark($light, $tok)";
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

# 暗いグラデーションの帯（見出しの背景など）は、色数を減らすため黒一色の帯にする
my $BAND = '#1d1d1f';
sub convert_gradient {
  my ($g, $mode) = @_;
  my @colors = $g =~ /($COLOR_RE)/g;
  my $band = @colors > 0;
  for my $c (@colors) {
    my $l = convert_color($c, $mode);
    my ($light) = $l =~ /^light-dark\((#[0-9a-f]{6}|rgba\([^)]*\))/;
    $stats{colors}--;
    if (!$light || $light =~ /^rgba/ || $light eq $ACCENT) { next }
    my ($r, $gg, $b) = map { hex } unpack '(A2)3', substr($light, 1);
    my ($L, $C) = rgb2lch($r, $gg, $b);
    $band = 0 if $L >= 62 || $C >= 10;
  }
  return undef unless $band;
  $g =~ s/($COLOR_RE)/$stats{colors}++, "light-dark($BAND, $1)"/ge;
  return $g;
}

sub convert_value {
  my ($value, $mode) = @_;
  $mode = 'shadow' if $mode eq 'var' && $value =~ /\d+px/ && $value =~ $COLOR_RE && $value !~ /gradient/;
  $mode = 'surface' if $mode eq 'var' || $mode eq 'other';
  if ($mode eq 'surface' && $value =~ /^\s*linear-gradient\(.*\)\s*$/s) {
    my $band = convert_gradient($value, $mode);
    return $band if defined $band;
  }
  $value =~ s/($COLOR_RE)/convert_color($1, $mode)/ge;
  return $value;
}

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
      $mode = (@used == 1 && $used[0] eq 'text') ? 'text' : (@used == 1 && $used[0] eq 'shadow') ? 'shadow' : 'var';
    } else {
      $mode = mode_of_prop($p);
    }
    $p . $sep . convert_value($v, $mode);
  }ge;
  return $css;
}

sub convert_js {
  my $js = shift;
  $js =~ s{(\.style\.(\w+)\s*=\s*["'])($COLOR_RE)}{$1 . convert_color($3, mode_of_prop($2 eq 'backgroundColor' ? 'background' : $2))}ge;
  # テンプレート内の style="..." 属性
  $js =~ s{(style=\\?["'])([^"'\\]*)}{$1 . convert_css($2)}ge;
  return $js;
}

for my $f (@ARGV) {
  open my $in, '<:raw', $f or die "$f: $!";
  my $s = do { local $/; <$in> };
  close $in;
  unless ($s =~ s{<meta name="color-scheme" content="dark">}{<meta name="color-scheme" content="light">}) {
    printf "%-40s skip（夜テーマ変換済みのページではない）\n", $f;
    next;
  }
  %stats = ();
  $s =~ s{(<style[^>]*>)(.*?)(</style>)}{$1 . convert_css($2) . $3}gse;
  $s =~ s{(<[a-zA-Z][^>]*?\sstyle=")([^"]*)(")}{$1 . convert_css($2) . $3}ge;
  $s =~ s{(<script>)(.*?)(</script>)}{$1 . convert_js($2) . $3}gse;
  printf "%-40s %4d colors\n", $f, $stats{colors} || 0;
  next if $DRY;
  open my $out, '>:raw', $f or die;
  print $out $s;
  close $out;
}
