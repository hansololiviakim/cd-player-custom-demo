import { useState, useRef, useEffect } from "react";
import { cd, sparkle, stamp, star, text } from "@/asset";

/**
 * CD 커스텀 (Canvas 기반)
 * - CD 이미지 위에 스티커를 자유롭게 추가/이동/크기조절/회전/삭제 가능
 * - 스티커는 드래그&드롭, 크기조절, 회전, z-index(겹침순서) 조정, 삭제 모두 지원
 * - 모바일 터치 완벽 지원 (이동/크기/회전)
 * - CD 영역(원형) 밖으로 나간 스티커는 자동으로 잘려서(clip) 안 보임
 *
 * 1. CD와 스티커 이미지를 미리 로드 (useRef)
 * 2. stickers 배열에 각 스티커의 위치/크기/회전 등 상태 저장
 * 3. drawStickers()에서 CD와 스티커를 Canvas에 그림 (clip, transform 활용)
 * 4. 마우스/터치 이벤트로 스티커 이동/크기/회전/순서조정/삭제
 */

function One() {
  // ====== 상태 관리 ======
  const canvasRef = useRef(null); // Canvas DOM 참조
  const [stickers, setStickers] = useState([]); // 모든 스티커 상태 (배열 순서가 z-index)
  const [selectedSticker, setSelectedSticker] = useState(null); // 선택된 스티커 인덱스
  const [isDragging, setIsDragging] = useState(false); // 드래그 중 여부
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // 스티커 내에서 클릭한 위치 오프셋
  const [resizeMode, setResizeMode] = useState(null); // 'move' | 'resize' | 'rotate' (현재 조작 모드)
  const [rotationOffset, setRotationOffset] = useState(0); // 회전 핸들용 오프셋

  // Shift 키 상태 관리 (비율 고정용)
  const [isShift, setIsShift] = useState(false);

  // 비율 고정 토글 (모바일용)
  const [isRatioLock, setIsRatioLock] = useState(false);

  // Shift 키 이벤트 리스너 등록
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") setIsShift(true);
    };
    const handleKeyUp = (e) => {
      if (e.key === "Shift") setIsShift(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 이미지 캐시 (CD, 스티커 이미지 미리 로드해서 drawStickers에서 재사용)
  const cdImageRef = useRef(null);
  const stickerImageCache = useRef({});

  // 버튼 스타일 (tailwind)
  const buttonStyle =
    "border border-amber-500 p-2 m-1 bg-white hover:bg-amber-100 transition-colors";

  // 핸들 크기 (스티커 크기조절/회전 핸들)
  const HANDLE_SIZE = 14;
  const ROTATE_HANDLE_OFFSET = 28;

  // ====== 이미지 미리 로드 (최초 1회) ======
  useEffect(() => {
    // CD 이미지
    const cdImg = new window.Image();
    cdImg.src = cd;
    cdImg.onload = () => {
      cdImageRef.current = cdImg;
      drawStickers(); // CD가 로드된 후 바로 그리기
    };
    // 스티커 이미지들
    const stickerSources = { sparkle, stamp, star, text };
    Object.entries(stickerSources).forEach(([key, src]) => {
      const img = new window.Image();
      img.src = src;
      stickerImageCache.current[key] = img;
    });
  }, []);

  // ====== Canvas 크기 초기화 (최초 1회) ======
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 400;
    canvas.height = 400;
  }, []);

  /**
   * CD와 스티커를 모두 그리는 함수 (상태가 바뀔 때마다 호출)
   * - 1. Canvas 초기화
   * - 2. CD 이미지 그리기
   * - 3. CD 원형 clip(마스킹) 적용 (스티커가 CD 밖으로 못 나가게)
   * - 4. 스티커들 transform(이동/회전/크기) 적용해서 그리기
   * - 5. 선택된 스티커는 테두리/핸들 표시
   */
  // drawStickers: hideBorder 옵션 추가 (저장 시 border 없이 그리기)
  const drawStickers = (hideBorder = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 전체 초기화

    // CD 이미지 위치/크기/clip 영역 계산
    const cdImg = cdImageRef.current;
    let cdCenterX, cdCenterY, cdRadius;
    if (cdImg && cdImg.complete) {
      const scale = Math.min(
        canvas.width / cdImg.width,
        canvas.height / cdImg.height
      );
      const scaledWidth = cdImg.width * scale;
      const scaledHeight = cdImg.height * scale;
      cdCenterX = (canvas.width - scaledWidth) / 2 + scaledWidth / 2 + 16;
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

    // CD 원형 영역 시각화 (디버깅용, 실제 clip 영역)
    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cdCenterX, cdCenterY, cdRadius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fillStyle = "rgba(136,136,136,0.2)";
      ctx.fill();
      ctx.restore();
    }

    // CD 원형 clip(마스킹) 적용: 이 안에서만 스티커가 보임
    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cdCenterX, cdCenterY, cdRadius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
    }

    // stickers 배열 순서대로 스티커 그리기 (뒤에 있는 게 위에 보임)
    stickers.forEach((sticker, index) => {
      let image;
      if (sticker.type === "custom") {
        image = stickerImageCache.current["custom-" + sticker.id];
      } else {
        image = stickerImageCache.current[sticker.type];
      }
      if (image && image.complete) {
        // transform: 이동/회전/크기
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

        // 선택된 스티커는 테두리/핸들 표시 (hideBorder가 false일 때만)
        if (!hideBorder && selectedSticker === index) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(sticker.rotation);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            -sticker.width / 2 - 2,
            -sticker.height / 2 - 2,
            sticker.width + 4,
            sticker.height + 4
          );
          // 크기조절 핸들(오른쪽 아래)
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
          // 회전 핸들(상단)
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

    // clip 해제 (다음 그리기 위해)
    if (cdCenterX && cdCenterY && cdRadius) {
      ctx.restore();
    }
  };

  /**
   * CD 중심 좌표 구하는 함수 (스티커 추가 시 중앙에 위치시키기 위함)
   */
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
      const cdCenterX = (canvas.width - scaledWidth) / 2 + scaledWidth / 2 + 16;
      const cdCenterY = (canvas.height - scaledHeight) / 2 + scaledHeight / 2;
      return { x: cdCenterX, y: cdCenterY };
    }
    // fallback
    return { x: 200, y: 200 };
  }

  /**
   * 스티커 추가 (버튼 클릭 시)
   * - CD 중심에 스티커가 생성됨
   */
  const addSticker = (type) => {
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
    const newSticker = {
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
    setStickers([...stickers, newSticker]);
  };

  /**
   * 마우스/터치 좌표 추출 (공통화)
   */
  function getPointerPosition(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }

  /**
   * 스티커 핸들(크기조절/회전) 위치 계산
   */
  const getStickerHandles = (sticker) => {
    const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
    const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
    // 오른쪽 아래(크기조절)
    const resize = rotatePoint(
      sticker.width / 2,
      sticker.height / 2,
      sticker.rotation
    );
    // 상단 중앙(회전)
    const rotate = rotatePoint(
      0,
      -sticker.height / 2 - ROTATE_HANDLE_OFFSET / sticker.scale,
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
      center: { x: centerX, y: centerY },
    };
  };

  // 회전 보조 함수 (좌표 회전)
  function rotatePoint(x, y, angle) {
    return {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    };
  }

  /**
   * 공통 핸들러 (마우스/터치 모두 지원)
   * - 스티커 클릭: 선택/이동
   * - 핸들 클릭: 크기조절/회전 모드 진입
   */
  const handlePointerDown = (e) => {
    if (e.touches) e.preventDefault(); // 모바일 스크롤 방지
    const { x, y } = getPointerPosition(e);
    if (selectedSticker !== null) {
      const sticker = stickers[selectedSticker];
      const handles = getStickerHandles(sticker);
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
        // 회전 오프셋 계산 (핸들 클릭 시 마우스 각도와 기존 회전값 차이 저장)
        const centerX = sticker.x + (sticker.width * sticker.scale) / 2;
        const centerY = sticker.y + (sticker.height * sticker.scale) / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const mouseAngle = Math.atan2(dy, dx) - Math.PI / 2;
        setRotationOffset(mouseAngle - sticker.rotation);
        return;
      }
    }
    // 스티커 클릭(선택/이동)
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
        setSelectedSticker(i);
        setResizeMode("move");
        setIsDragging(true);
        setDragOffset({ x: localX, y: localY });
        return;
      }
    }
    setSelectedSticker(null);
  };

  /**
   * 이동/크기조절/회전 드래그 처리 (마우스/터치)
   * - move: 스티커 위치 이동
   * - resize: 오른쪽 아래 핸들 드래그로 width/height 직접 조절
   * - rotate: 위쪽 원 핸들 드래그로 회전
   */
  const handlePointerMove = (e) => {
    if (!isDragging || selectedSticker === null) return;
    if (e.touches) e.preventDefault();
    const { x, y } = getPointerPosition(e);
    const updatedStickers = [...stickers];
    const sticker = updatedStickers[selectedSticker];
    if (resizeMode === "move") {
      // 이동: 클릭한 오프셋만큼 보정해서 위치 이동
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
        Math.min(newX, canvasRef.current.width - sticker.width * sticker.scale)
      );
      sticker.y = Math.max(
        0,
        Math.min(
          newY,
          canvasRef.current.height - sticker.height * sticker.scale
        )
      );
    } else if (resizeMode === "resize") {
      // 크기조절: 오른쪽 아래 핸들 기준 width/height 직접 조절
      const left = sticker.x;
      const top = sticker.y;
      const dx = x - left;
      const dy = y - top;
      const angle = -sticker.rotation;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (isShift || isRatioLock) {
        // Shift 또는 토글: 비율 고정
        const ratio = sticker.width / sticker.height;
        if (localX / localY > ratio) {
          const newWidth = Math.max(20, localX);
          const newHeight = Math.max(20, localX / ratio);
          sticker.width = newWidth;
          sticker.height = newHeight;
        } else {
          const newHeight = Math.max(20, localY);
          const newWidth = Math.max(20, localY * ratio);
          sticker.width = newWidth;
          sticker.height = newHeight;
        }
      } else {
        // 자유 비율
        const newWidth = Math.max(20, localX);
        const newHeight = Math.max(20, localY);
        sticker.width = newWidth;
        sticker.height = newHeight;
      }
    } else if (resizeMode === "rotate") {
      // 회전: 중심 기준으로 마우스 각도 계산
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

  /**
   * 드래그 종료 (마우스/터치)
   */
  const handlePointerUp = () => {
    setIsDragging(false);
    setResizeMode(null);
    setRotationOffset(0);
  };

  /**
   * 스티커 z-index 조정 (겹침 순서)
   * - bringStickerForward: 한 칸 위로
   * - sendStickerBackward: 한 칸 아래로
   */
  const bringStickerForward = () => {
    if (selectedSticker === null || selectedSticker === stickers.length - 1)
      return;
    const newStickers = [...stickers];
    [newStickers[selectedSticker], newStickers[selectedSticker + 1]] = [
      newStickers[selectedSticker + 1],
      newStickers[selectedSticker],
    ];
    setStickers(newStickers);
    setSelectedSticker(selectedSticker + 1);
  };
  const sendStickerBackward = () => {
    if (selectedSticker === null || selectedSticker === 0) return;
    const newStickers = [...stickers];
    [newStickers[selectedSticker], newStickers[selectedSticker - 1]] = [
      newStickers[selectedSticker - 1],
      newStickers[selectedSticker],
    ];
    setStickers(newStickers);
    setSelectedSticker(selectedSticker - 1);
  };

  /**
   * 스티커 삭제
   */
  const deleteSelectedSticker = () => {
    if (selectedSticker !== null) {
      const updatedStickers = stickers.filter(
        (_, index) => index !== selectedSticker
      );
      setStickers(updatedStickers);
      setSelectedSticker(null);
      drawStickers();
    }
  };

  /**
   * 전체 스티커 삭제
   */
  const deleteAllStickers = () => {
    setStickers([]);
    setSelectedSticker(null);
  };

  /**
   * 캔버스 이미지를 jpg로 저장 (저장하기 버튼 클릭 시)
   */
  // handleSaveImage: border 없이 저장
  const handleSaveImage = () => {
    drawStickers(true); // border 없이 그림
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const fileName = `cd-${pad(now.getFullYear() % 100)}${pad(
      now.getMonth() + 1
    )}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(
      now.getSeconds()
    )}.png`;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
    drawStickers(); // 다시 border 보이게
  };

  /**
   * 이미지 업로드 후 스티커로 추가
   */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      // 업로드 이미지를 스티커로 추가 (type: 'custom', src: dataUrl)
      const width = 50;
      const height = 50;
      const center = getCDCenter();
      const newSticker = {
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
      // 캐시에 이미지 객체 추가
      const img = new window.Image();
      img.src = dataUrl;
      stickerImageCache.current["custom-" + newSticker.id] = img;
      setStickers([...stickers, newSticker]);
    };
    reader.readAsDataURL(file);
    // input value 초기화 (같은 파일 연속 업로드 가능하게)
    e.target.value = "";
  };

  // stickers, selectedSticker가 바뀔 때마다 다시 그림
  useEffect(() => {
    drawStickers();
  }, [stickers, selectedSticker]);

  return (
    <div className="w-full mx-auto h-full p-4">
      <div className="max-w-2xl mx-auto">
        <section className="bg-amber-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-amber-800">CD 커스텀</h2>
            <div className="flex flex-col gap-1 items-end">
              {/* 저장하기, 한 칸 아래로, 한 칸 위로 */}
              <div className="flex gap-2 mb-1">
                <button
                  onClick={handleSaveImage}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors text-xs"
                >
                  저장하기
                </button>
                {selectedSticker !== null && (
                  <>
                    <button
                      onClick={sendStickerBackward}
                      className="bg-gray-300 text-gray-800 px-2 py-1 rounded hover:bg-gray-400 transition-colors text-xs"
                      title="한 칸 아래로"
                      disabled={selectedSticker === 0}
                    >
                      ↓ 한 칸 아래로
                    </button>
                    <button
                      onClick={bringStickerForward}
                      className="bg-gray-300 text-gray-800 px-2 py-1 rounded hover:bg-gray-400 transition-colors text-xs"
                      title="한 칸 위로"
                      disabled={selectedSticker === stickers.length - 1}
                    >
                      ↑ 한 칸 위로
                    </button>
                  </>
                )}
              </div>
              {/* 전체 삭제, 선택된 스티커 삭제 */}
              <div className="flex gap-2">
                <button
                  onClick={deleteAllStickers}
                  className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 transition-colors text-xs"
                  disabled={stickers.length === 0}
                >
                  전체 삭제
                </button>
                {selectedSticker !== null && (
                  <button
                    onClick={deleteSelectedSticker}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors text-xs"
                  >
                    선택된 스티커 삭제
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border-2 border-amber-300 rounded-lg cursor-pointer"
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
        </section>

        <section className="mb-4 mt-4">
          <div className="grid grid-cols-2 bg-amber-400 p-4 rounded-lg">
            <button
              type="button"
              className={buttonStyle}
              onClick={() => addSticker("sparkle")}
            >
              sparkle
            </button>
            <button
              type="button"
              className={buttonStyle}
              onClick={() => addSticker("stamp")}
            >
              stamp
            </button>
            <button
              type="button"
              className={buttonStyle}
              onClick={() => addSticker("star")}
            >
              star
            </button>
            <button
              type="button"
              className={buttonStyle}
              onClick={() => addSticker("text")}
            >
              text
            </button>
          </div>
          {/* 비율 고정 토글 (모바일용) */}
          <div className="mt-2 flex justify-center">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-white">
              <input
                type="checkbox"
                checked={isRatioLock}
                onChange={(e) => setIsRatioLock(e.target.checked)}
                className="accent-blue-500"
              />
              비율 고정
            </label>
          </div>
          {/* 이미지 업로드 버튼 */}
          <div className="mt-2 flex justify-center">
            <label className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors text-xs cursor-pointer">
              이미지 업로드
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export default One;
