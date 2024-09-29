# 设置图片的目标宽度和高度
$targetWidth = 32
$targetHeight = 32

# 获取当前脚本所在的文件夹路径
$sourceFolder = (Get-Location).Path

# 获取所有 PNG 文件
$files = Get-ChildItem -Path $sourceFolder -Filter *.png

# 检查是否有 PNG 文件
if ($files.Count -eq 0) {
    Write-Host "当前文件夹中没有找到 PNG 图片。"
    exit
}

# 遍历每个文件并判断长宽
foreach ($file in $files) {
    $inputPath = $file.FullName

    # 使用 ImageMagick 读取图片的宽度和高度
    $imageInfo = magick identify -format "%w %h" $inputPath
    $width, $height = $imageInfo -split " "

    # 将宽度和高度转换为整数
    $width = [int]$width
    $height = [int]$height

    # 判断图片是否长宽大于 32
    if ($width -gt 32 -or $height -gt 32) {
        # 调整大小为 32x32 并覆盖原文件
        magick convert $inputPath -resize ${targetWidth}x${targetHeight}! $inputPath
        Write-Host "图片 $($file.Name) 已调整为 32x32。"
    } else {
        Write-Host "图片 $($file.Name) 长宽均小于或等于 32，未进行处理。"
    }
}

Write-Host "所有图片处理完毕。"
