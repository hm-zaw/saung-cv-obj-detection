import torch
from ultralytics import YOLO

def convert_pytorch_to_onnx():
    # Load the YOLO model
    model = YOLO('app/object_detection/best.pt')
    
    # Export to ONNX format
    model.export(format='onnx', imgsz=640, simplify=True)
    
    print("Model converted to ONNX format successfully!")
    print("Output file: app/object_detection/best.onnx")

if __name__ == "__main__":
    convert_pytorch_to_onnx()
