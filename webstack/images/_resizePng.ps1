# ����ͼƬ��Ŀ���Ⱥ͸߶�
$targetWidth = 32
$targetHeight = 32

# ��ȡ��ǰ�ű����ڵ��ļ���·��
$sourceFolder = (Get-Location).Path

# ��ȡ���� PNG �ļ�
$files = Get-ChildItem -Path $sourceFolder -Filter *.png

# ����Ƿ��� PNG �ļ�
if ($files.Count -eq 0) {
    Write-Host "��ǰ�ļ�����û���ҵ� PNG ͼƬ��"
    exit
}

# ����ÿ���ļ����жϳ���
foreach ($file in $files) {
    $inputPath = $file.FullName

    # ʹ�� ImageMagick ��ȡͼƬ�Ŀ�Ⱥ͸߶�
    $imageInfo = magick identify -format "%w %h" $inputPath
    $width, $height = $imageInfo -split " "

    # ����Ⱥ͸߶�ת��Ϊ����
    $width = [int]$width
    $height = [int]$height

    # �ж�ͼƬ�Ƿ񳤿���� 32
    if ($width -gt 32 -or $height -gt 32) {
        # ������СΪ 32x32 ������ԭ�ļ�
        magick convert $inputPath -resize ${targetWidth}x${targetHeight}! $inputPath
        Write-Host "ͼƬ $($file.Name) �ѵ���Ϊ 32x32��"
    } else {
        Write-Host "ͼƬ $($file.Name) �����С�ڻ���� 32��δ���д���"
    }
}

Write-Host "����ͼƬ������ϡ�"
