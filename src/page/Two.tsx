import { useState, useRef, useEffect } from "react";
import { cd, sparkle, stamp, star, text } from "@/asset";
import cdCustomData from "@/data/cd-custom-data.json";

// 타입 정의
interface Sticker {
  id: number;
  type: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface ActionHistory {
  type: "add" | "delete" | "move" | "resize" | "rotate" | "select";
  sticker?: Sticker;
  stickerIndex?: number;
  previousState?: Sticker;
  currentState?: Sticker;
  previousIndex?: number;
}

interface CDCustomData {
  stickers: Sticker[];
  createdAt: string;
  updatedAt: string;
}

/**
 * CD 커스텀 v2 (모바일 스타일)
 * - 모바일 앱 스타일 UI
 * - 스티커 클릭 시 우상단 X 버튼으로 개별 삭제
 * - 정비율 확대/축소만 가능
 * - 스티커 클릭 시 자동으로 최상위 레이어로 이동
 * - 되돌리기/뒤로가기 기능 (액션 히스토리 추적)
 * - 하단 스티커 미리보기 영역
 * - 스티커 데이터 저장/로드 기능 (프로젝트 내 JSON 파일)
 */

function Two() {
  // ====== 상태 관리 ======
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeMode, setResizeMode] = useState<
    "move" | "resize" | "rotate" | null
  >(null);
  const [rotationOffset, setRotationOffset] = useState(0);

  // 액션 히스토리 (되돌리기/뒤로가기용)
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 이미지 캐시
  const cdImageRef = useRef<HTMLImageElement | null>(null);
  const stickerImageCache = useRef<{ [key: string]: HTMLImageElement }>({});

  // 핸들 크기
  const HANDLE_SIZE = 14;
  const ROTATE_HANDLE_OFFSET = 28;
  const DELETE_BUTTON_SIZE = 20;

  // ====== 데이터 저장/로드 함수 ======
  const saveStickerData = () => {
    const data: CDCustomData = {
      stickers: stickers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 콘솔에 저장할 데이터 출력 (실제로는 파일에 저장)
    console.log("저장할 데이터:", JSON.stringify(data, null, 2));

    // 개발 환경에서는 파일 직접 수정이 어려우므로 콘솔에 출력
    // 프로덕션에서는 서버 API를 통해 파일에 저장
    alert(
      "데이터가 콘솔에 출력되었습니다. src/data/cd-custom-data.json 파일에 복사해서 붙여넣으세요!"
    );
  };

  const loadStickerData = () => {
    // JSON 파일에서 데이터 로드
    const data: CDCustomData = cdCustomData as CDCustomData;

    if (data.stickers && data.stickers.length > 0) {
      // 스티커 상태 복원
      setStickers(data.stickers);

      // 이미지 캐시도 복원
      data.stickers.forEach((sticker) => {
        if (sticker.type === "custom") {
          const img = new window.Image();
          img.src = sticker.src;
          stickerImageCache.current["custom-" + sticker.id] = img;
        }
      });

      // 히스토리 초기화
      setActionHistory([]);
      setHistoryIndex(-1);

      console.log("저장된 데이터를 불러왔습니다.");
    } else {
      // 저장된 데이터가 없으면 조용히 초기 상태 유지
      console.log("저장된 데이터가 없습니다. 초기 상태로 시작합니다.");
    }
  };

  // 완료 버튼 핸들러
  const handleComplete = () => {
    saveStickerData();
    // 여기에 완료 처리 로직 추가 (예: 페이지 이동 등)
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadStickerData();
  }, []);

  // ====== 이미지 미리 로드 ======
  useEffect(() => {
    const cdImg = new window.Image();
    cdImg.src = cd;
    cdImg.onload = () => {
      cdImageRef.current = cdImg;
      drawStickers();
    };

    const stickerSources = { sparkle, stamp, star, text };
    Object.entries(stickerSources).forEach(([key, src]) => {
      const img = new window.Image();
      img.src = src;
      stickerImageCache.current[key] = img;
    });
  }, []);

  // ====== Canvas 크기 초기화 ======
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 300;
      canvas.height = 300;
    }
  }, []);

  // ====== 액션 히스토리 관리 ======
  const addToHistory = (action: ActionHistory) => {
    const newHistory = actionHistory.slice(0, historyIndex + 1);
    newHistory.push(action);
    setActionHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex < 0) return;

    const action = actionHistory[historyIndex];
    if (action.type === "add" && action.stickerIndex !== undefined) {
      // 스티커 추가를 되돌리기
      setStickers((prev) =>
        prev.filter((_, index) => index !== action.stickerIndex)
      );
      setSelectedSticker(null);
    } else if (
      action.type === "delete" &&
      action.sticker &&
      action.stickerIndex !== undefined
    ) {
      // 스티커 삭제를 되돌리기
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers.splice(action.stickerIndex!, 0, action.sticker!);
        return newStickers;
      });
      setSelectedSticker(action.stickerIndex);
    } else if (
      action.type === "move" &&
      action.stickerIndex !== undefined &&
      action.previousState
    ) {
      // 스티커 이동을 되돌리기
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.previousState!;
        return newStickers;
      });
    } else if (
      action.type === "resize" &&
      action.stickerIndex !== undefined &&
      action.previousState
    ) {
      // 스티커 크기 변경을 되돌리기
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.previousState!;
        return newStickers;
      });
    } else if (
      action.type === "rotate" &&
      action.stickerIndex !== undefined &&
      action.previousState
    ) {
      // 스티커 회전을 되돌리기
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.previousState!;
        return newStickers;
      });
    } else if (
      action.type === "select" &&
      action.stickerIndex !== undefined &&
      action.previousIndex !== undefined
    ) {
      // 스티커 선택(z-index 변경)을 되돌리기
      setStickers((prev) => {
        const newStickers = [...prev];
        [
          newStickers[action.stickerIndex!],
          newStickers[action.previousIndex!],
        ] = [
          newStickers[action.previousIndex!],
          newStickers[action.stickerIndex!],
        ];
        return newStickers;
      });
      setSelectedSticker(action.previousIndex);
    }

    setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex >= actionHistory.length - 1) return;

    const action = actionHistory[historyIndex + 1];
    if (
      action.type === "add" &&
      action.sticker &&
      action.stickerIndex !== undefined
    ) {
      // 스티커 추가를 다시 실행
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers.splice(action.stickerIndex!, 0, action.sticker!);
        return newStickers;
      });
      setSelectedSticker(action.stickerIndex);
    } else if (action.type === "delete" && action.stickerIndex !== undefined) {
      // 스티커 삭제를 다시 실행
      setStickers((prev) =>
        prev.filter((_, index) => index !== action.stickerIndex)
      );
      setSelectedSticker(null);
    } else if (
      action.type === "move" &&
      action.stickerIndex !== undefined &&
      action.currentState
    ) {
      // 스티커 이동을 다시 실행
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.currentState!;
        return newStickers;
      });
    } else if (
      action.type === "resize" &&
      action.stickerIndex !== undefined &&
      action.currentState
    ) {
      // 스티커 크기 변경을 다시 실행
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.currentState!;
        return newStickers;
      });
    } else if (
      action.type === "rotate" &&
      action.stickerIndex !== undefined &&
      action.currentState
    ) {
      // 스티커 회전을 다시 실행
      setStickers((prev) => {
        const newStickers = [...prev];
        newStickers[action.stickerIndex!] = action.currentState!;
        return newStickers;
      });
    } else if (
      action.type === "select" &&
      action.stickerIndex !== undefined &&
      action.previousIndex !== undefined
    ) {
      // 스티커 선택(z-index 변경)을 다시 실행
      setStickers((prev) => {
        const newStickers = [...prev];
        [
          newStickers[action.previousIndex!],
          newStickers[action.stickerIndex!],
        ] = [
          newStickers[action.stickerIndex!],
          newStickers[action.previousIndex!],
        ];
        return newStickers;
      });
      setSelectedSticker(action.stickerIndex);
    }

    setHistoryIndex(historyIndex + 1);
  };

  // ====== CD 중심 좌표 구하기 ======
  function getCDCenter() {
    const canvas = canvasRef.current;
    const cdImg = cdImageRef.current;
    if (canvas && cdImg && cdImg.complete) {
      const scale = Math.min(
        canvas.width / cdImg.width,
        canvas.height / cdImg.height
      );
      const scaledWidth = cdImg.width * scale;
      const scaledHeight = cdImg.height * scale;
      const cdCenterX = (canvas.width - scaledWidth) / 2 + scaledWidth / 2;
      const cdCenterY = (canvas.height - scaledHeight) / 2 + scaledHeight / 2;
      return { x: cdCenterX, y: cdCenterY };
    }
    return { x: 150, y: 150 };
  }

  // ====== 스티커 그리기 ======
  const drawStickers = (hideBorder = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // CD 이미지 그리기
    const cdImg = cdImageRef.current;
    let cdCenterX, cdCenterY, cdRadius;
    if (cdImg && cdImg.complete) {
      const scale = Math.min(
        canvas.width / cdImg.width,
        canvas.height / cdImg.height
      );
      const scaledWidth = cdImg.width * scale;
      const scaledHeight = cdImg.height * scale;
      cdCenterX = (canvas.width - scaledWidth) / 2 + scaledWidth / 2;
      cdCenterY = (canvas.height - scaledHeight) / 2 + scaledHeight / 2;
      cdRadius = Math.min(scaledWidth, scaledHeight) / 2.9 + 1;
      ctx.drawImage(
        cdImg,
        (canvas.width - scaledWidth) / 2,
        (canvas.height - scaledHeight) / 2,
        scaledWidth,
        scaledHeight
      );
    }

    // CD 원형 영역 시각화
    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cdCenterX, cdCenterY, cdRadius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fillStyle = "rgba(136,136,136,0.2)";
      ctx.fill();
      ctx.restore();
    }

    // CD 원형 clip 적용
    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cdCenterX, cdCenterY, cdRadius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
    }

    // 스티커들 그리기
    stickers.forEach((sticker, index) => {
      let image;
      if (sticker.type === "custom") {
        image = stickerImageCache.current["custom-" + sticker.id];
      } else {
        image = stickerImageCache.current[sticker.type];
      }
      if (image && image.complete) {
        const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
        const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(sticker.rotation);
        ctx.scale(sticker.scale, sticker.scale);
        ctx.drawImage(
          image,
          -sticker.width / 2,
          -sticker.height / 2,
          sticker.width,
          sticker.height
        );
        ctx.restore();

        // 선택된 스티커 테두리와 핸들 표시
        if (!hideBorder && selectedSticker === index) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(sticker.rotation);

          // 테두리
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            -sticker.width / 2 - 2,
            -sticker.height / 2 - 2,
            sticker.width + 4,
            sticker.height + 4
          );

          // 삭제 버튼 (우상단)
          ctx.fillStyle = "#ef4444";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            sticker.width / 2 + 10,
            -sticker.height / 2 - 10,
            DELETE_BUTTON_SIZE / 2,
            0,
            2 * Math.PI
          );
          ctx.fill();
          ctx.stroke();

          // X 표시
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sticker.width / 2 + 10 - 4, -sticker.height / 2 - 10 - 4);
          ctx.lineTo(sticker.width / 2 + 10 + 4, -sticker.height / 2 - 10 + 4);
          ctx.moveTo(sticker.width / 2 + 10 + 4, -sticker.height / 2 - 10 - 4);
          ctx.lineTo(sticker.width / 2 + 10 - 4, -sticker.height / 2 - 10 + 4);
          ctx.stroke();

          // 크기조절 핸들 (우하단, 정비율용)
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(
            sticker.width / 2 - HANDLE_SIZE / 2,
            sticker.height / 2 - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
          ctx.fill();
          ctx.stroke();

          // 회전 핸들 (상단)
          ctx.beginPath();
          ctx.arc(
            0,
            -sticker.height / 2 - ROTATE_HANDLE_OFFSET,
            HANDLE_SIZE / 2,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.stroke();

          // 회전 핸들 연결선
          ctx.beginPath();
          ctx.moveTo(0, -sticker.height / 2);
          ctx.lineTo(0, -sticker.height / 2 - ROTATE_HANDLE_OFFSET);
          ctx.stroke();

          ctx.restore();
        }
      }
    });

    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.restore();
    }
  };

  // ====== 스티커 추가 ======
  const addSticker = (type: string) => {
    let src;
    switch (type) {
      case "sparkle":
        src = sparkle;
        break;
      case "stamp":
        src = stamp;
        break;
      case "star":
        src = star;
        break;
      case "text":
        src = text;
        break;
      default:
        return;
    }
    const width = 50;
    const height = 50;
    const center = getCDCenter();
    const newSticker: Sticker = {
      id: Date.now(),
      type,
      src,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      scale: 1,
      rotation: 0,
    };

    const newStickers = [...stickers, newSticker];
    setStickers(newStickers);
    setSelectedSticker(newStickers.length - 1);

    // 히스토리에 추가
    addToHistory({
      type: "add",
      sticker: newSticker,
      stickerIndex: newStickers.length - 1,
    });
  };

  // ====== 스티커 삭제 ======
  const deleteSelectedSticker = () => {
    if (selectedSticker !== null) {
      const deletedSticker = stickers[selectedSticker];
      const updatedStickers = stickers.filter(
        (_, index) => index !== selectedSticker
      );
      setStickers(updatedStickers);
      setSelectedSticker(null);

      // 히스토리에 추가
      addToHistory({
        type: "delete",
        sticker: deletedSticker,
        stickerIndex: selectedSticker,
      });
    }
  };

  // ====== 마우스/터치 좌표 추출 ======
  function getPointerPosition(e: MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  }

  // ====== 스티커 핸들 위치 계산 ======
  const getStickerHandles = (sticker: Sticker) => {
    const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
    const centerY = sticker.y + (sticker.height * sticker.scale) / 2;

    const resize = rotatePoint(
      sticker.width / 2,
      sticker.height / 2,
      sticker.rotation
    );
    const rotate = rotatePoint(
      0,
      -sticker.height / 2 - ROTATE_HANDLE_OFFSET / sticker.scale,
      sticker.rotation
    );
    const deleteBtn = rotatePoint(
      sticker.width / 2 + 10 / sticker.scale,
      -sticker.height / 2 - 10 / sticker.scale,
      sticker.rotation
    );

    return {
      resize: {
        x: centerX + resize.x * sticker.scale,
        y: centerY + resize.y * sticker.scale,
      },
      rotate: {
        x: centerX + rotate.x * sticker.scale,
        y: centerY + rotate.y * sticker.scale,
      },
      delete: {
        x: centerX + deleteBtn.x * sticker.scale,
        y: centerY + deleteBtn.y * sticker.scale,
      },
      center: { x: centerX, y: centerY },
    };
  };

  // 회전 보조 함수
  function rotatePoint(x: number, y: number, angle: number) {
    return {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    };
  }

  // ====== 포인터 이벤트 핸들러 ======
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) e.preventDefault();
    const { x, y } = getPointerPosition(e.nativeEvent);

    if (selectedSticker !== null) {
      const sticker = stickers[selectedSticker];
      const handles = getStickerHandles(sticker);

      // 삭제 버튼 체크
      if (
        Math.hypot(x - handles.delete.x, y - handles.delete.y) <
        DELETE_BUTTON_SIZE / 2
      ) {
        deleteSelectedSticker();
        return;
      }

      // 크기조절 핸들 체크
      if (
        Math.abs(x - handles.resize.x) < HANDLE_SIZE &&
        Math.abs(y - handles.resize.y) < HANDLE_SIZE
      ) {
        setResizeMode("resize");
        setIsDragging(true);
        return;
      }

      // 회전 핸들 체크
      if (
        Math.hypot(x - handles.rotate.x, y - handles.rotate.y) < HANDLE_SIZE
      ) {
        setResizeMode("rotate");
        setIsDragging(true);
        const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
        const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const mouseAngle = Math.atan2(dy, dx) - Math.PI / 2;
        setRotationOffset(mouseAngle - sticker.rotation);
        return;
      }
    }

    // 스티커 클릭 (선택/이동)
    for (let i = stickers.length - 1; i >= 0; i--) {
      const sticker = stickers[i];
      const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
      const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = -sticker.rotation;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

      if (
        localX >= -sticker.width / 2 &&
        localX <= sticker.width / 2 &&
        localY >= -sticker.height / 2 &&
        localY <= sticker.height / 2
      ) {
        // 스티커 클릭 시 최상위로 이동
        if (selectedSticker !== i) {
          const newStickers = [...stickers];
          const clickedSticker = newStickers.splice(i, 1)[0];
          newStickers.push(clickedSticker);
          setStickers(newStickers);
          setSelectedSticker(newStickers.length - 1);

          // 히스토리에 추가 (z-index 변경이 실제 액션이므로)
          addToHistory({
            type: "select",
            stickerIndex: newStickers.length - 1,
            previousIndex: i,
          });
        } else {
          // 같은 스티커를 다시 클릭한 경우는 히스토리에 기록하지 않음
          setSelectedSticker(i);
        }

        setResizeMode("move");
        setIsDragging(true);
        setDragOffset({ x: localX, y: localY });
        return;
      }
    }

    // 백그라운드 클릭 (스티커 선택 해제) - 히스토리에 기록하지 않음
    setSelectedSticker(null);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || selectedSticker === null) return;
    if ("touches" in e) e.preventDefault();

    const { x, y } = getPointerPosition(e.nativeEvent);
    const updatedStickers = [...stickers];
    const sticker = updatedStickers[selectedSticker];

    if (resizeMode === "move") {
      // 이동
      const newX =
        x -
        (Math.cos(sticker.rotation) * dragOffset.x -
          Math.sin(sticker.rotation) * dragOffset.y) -
        (sticker.width * sticker.scale) / 2;
      const newY =
        y -
        (Math.sin(sticker.rotation) * dragOffset.x +
          Math.cos(sticker.rotation) * dragOffset.y) -
        (sticker.height * sticker.scale) / 2;
      sticker.x = Math.max(
        0,
        Math.min(newX, canvasRef.current!.width - sticker.width * sticker.scale)
      );
      sticker.y = Math.max(
        0,
        Math.min(
          newY,
          canvasRef.current!.height - sticker.height * sticker.scale
        )
      );
    } else if (resizeMode === "resize") {
      // 정비율 크기조절
      const left = sticker.x;
      const top = sticker.y;
      const dx = x - left;
      const dy = y - top;
      const angle = -sticker.rotation;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

      // 정비율 계산
      const ratio = sticker.width / sticker.height;
      const newSize = Math.max(20, Math.max(localX, localY));
      sticker.width = newSize;
      sticker.height = newSize / ratio;
    } else if (resizeMode === "rotate") {
      // 회전
      const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
      const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const mouseAngle = Math.atan2(dy, dx) - Math.PI / 2;
      sticker.rotation = mouseAngle - rotationOffset;
    }

    setStickers(updatedStickers);
    drawStickers();
  };

  const handlePointerUp = () => {
    if (isDragging && selectedSticker !== null && resizeMode) {
      // 드래그가 끝날 때만 히스토리에 추가
      const sticker = stickers[selectedSticker];

      if (resizeMode === "move") {
        addToHistory({
          type: "move",
          stickerIndex: selectedSticker,
          previousState: { ...sticker },
          currentState: sticker,
        });
      } else if (resizeMode === "resize") {
        addToHistory({
          type: "resize",
          stickerIndex: selectedSticker,
          previousState: { ...sticker },
          currentState: sticker,
        });
      } else if (resizeMode === "rotate") {
        addToHistory({
          type: "rotate",
          stickerIndex: selectedSticker,
          previousState: { ...sticker },
          currentState: sticker,
        });
      }
    }

    setIsDragging(false);
    setResizeMode(null);
    setRotationOffset(0);
  };

  // ====== 이미지 저장 ======
  const handleSaveImage = () => {
    drawStickers(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fileName = `cd-v2-${pad(now.getFullYear() % 100)}${pad(
      now.getMonth() + 1
    )}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(
      now.getSeconds()
    )}.png`;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
    drawStickers();
  };

  // ====== 이미지 업로드 ======
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const width = 50;
      const height = 50;
      const center = getCDCenter();
      const newSticker: Sticker = {
        id: Date.now(),
        type: "custom",
        src: dataUrl,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        scale: 1,
        rotation: 0,
      };

      const img = new window.Image();
      img.src = dataUrl;
      stickerImageCache.current["custom-" + newSticker.id] = img;

      const newStickers = [...stickers, newSticker];
      setStickers(newStickers);
      setSelectedSticker(newStickers.length - 1);

      addToHistory({
        type: "add",
        sticker: newSticker,
        stickerIndex: newStickers.length - 1,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ====== 스티커 미리보기 렌더링 ======
  const renderStickerPreview = () => {
    const stickerTypes = [
      { type: "sparkle", src: sparkle },
      { type: "stamp", src: stamp },
      { type: "star", src: star },
      { type: "text", src: text },
    ];

    return (
      <div className="grid grid-cols-4 gap-2 mt-4">
        {/* 이미지 업로드 버튼을 맨 첫 번째로 */}
        <div
          className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors"
          onClick={() => document.getElementById("imageUpload")?.click()}
        >
          <span className="text-white text-2xl">+</span>
        </div>
        <input
          id="imageUpload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />

        {/* 기존 스티커들 */}
        {stickerTypes.map((sticker, index) => (
          <div
            key={index}
            className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
            onClick={() => addSticker(sticker.type)}
          >
            <img
              src={sticker.src}
              alt={sticker.type}
              className="w-8 h-8 object-contain"
            />
          </div>
        ))}
      </div>
    );
  };

  // stickers, selectedSticker가 바뀔 때마다 다시 그림
  useEffect(() => {
    drawStickers();
  }, [stickers, selectedSticker]);

  return (
    <div className="w-full h-full bg-gray-100 flex justify-center">
      <div className="w-full max-w-[400px] min-w-[320px] bg-white h-full flex flex-col">
        {/* 상단 헤더 */}
        <div className="bg-white p-4 flex justify-between items-center border-b border-gray-200">
          <button className="text-gray-600">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">CD 커스텀</h1>
          <div className="flex gap-2">
            <button
              onClick={loadStickerData}
              className="text-gray-600 bg-gray-200 px-3 py-1 rounded-lg text-sm cursor-pointer hover:bg-gray-300 transition-colors"
            >
              불러오기
            </button>
            <button
              onClick={handleComplete}
              className="text-gray-600 bg-gray-200 px-3 py-1 rounded-lg text-sm hover:bg-gray-300 transition-colors"
            >
              완료
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex flex-col">
          {/* CD 영역 (55%) */}
          <div className="h-[55%] bg-[#f9fafb] p-4 relative">
            <div className="flex justify-center items-center h-full">
              <canvas
                ref={canvasRef}
                className="border-2 border-gray-300 rounded-full cursor-pointer"
                style={{ touchAction: "none" }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              />
            </div>

            {/* 플로팅 버튼들 - CD 오른쪽 */}
            <div className="absolute right-4 bottom-10 space-y-4 z-10">
              <button
                onClick={undo}
                disabled={historyIndex < 0}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= actionHistory.length - 1}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
              <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 하단 영역 (45%) */}
          <div className="h-[45%] bg-white p-4 overflow-y-auto">
            {/* 테마 탭 */}
            <div className="mb-4">
              <div className="flex space-x-2 overflow-x-auto">
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg whitespace-nowrap text-sm">
                  (테마)
                </button>
                <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg whitespace-nowrap text-sm">
                  (테마)
                </button>
                <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg whitespace-nowrap text-sm">
                  (테마)
                </button>
              </div>
            </div>

            {/* 스티커 미리보기 */}
            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">스티커</h3>
              <div className="grid grid-cols-4 gap-1">
                {/* 이미지 업로드 버튼을 맨 첫 번째로 */}
                <div
                  className="w-full h-full aspect-square bg-blue-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors"
                  onClick={() =>
                    document.getElementById("imageUpload")?.click()
                  }
                >
                  <span className="text-white text-3xl">+</span>
                </div>
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                />

                {/* 기존 스티커들 */}
                {[
                  { type: "sparkle", src: sparkle },
                  { type: "stamp", src: stamp },
                  { type: "star", src: star },
                  { type: "text", src: text },
                ].map(
                  (sticker: { type: string; src: string }, index: number) => (
                    <div
                      key={index}
                      className="w-full h-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
                      onClick={() => addSticker(sticker.type)}
                    >
                      <img
                        src={sticker.src}
                        alt={sticker.type}
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Two;
