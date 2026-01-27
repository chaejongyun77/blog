## 문제 상황

어드민 페이지에서 엑셀 다운로드 기능을 공통으로 구현하던 중, 테스트 과정에서 심각한 문제를 발견했습니다. 서버의 CPU 사용률이 급격히 증가하면서 최종적으로 **OOM(Out Of Memory)** 에러가 발생한 것입니다. 이번 포스팅에서는 이 문제를 어떻게 분석하고 해결했는지 공유하고자 합니다.

## OOM이란 무엇인가?

**OOM(Out Of Memory)**은 JVM의 힙(Heap) 메모리가 부족하여 더 이상 객체를 할당할 수 없을 때 발생하는 에러입니다. `java.lang.OutOfMemoryError`가 발생하면 애플리케이션이 정상적으로 동작하지 못하고, 심한 경우 서버 전체가 다운될 수 있습니다.

## 왜 OOM이 발생했는가?

30만 건 이상의 데이터를 엑셀 파일로 다운로드할 때 Heap 메모리 사용량이 급격히 증가하면서 OOM이 발생했습니다. 모니터링 결과, Heap 크기가 **4GB 가까이 증가**하는 것을 확인할 수 있었고, 이로 인해 서버에 과부하가 발생했습니다.

원인을 파악하기 위해 코드를 분석한 결과, 문제는 사용 중이던 엑셀 라이브러리에 있었습니다.

## XSSFWorkbook 라이브러리 문제

현재 엑셀 다운로드를 위해 Apache POI의 **XSSFWorkbook** 라이브러리를 사용하고 있었는데, 바로 여기에 문제의 원인이 있었습니다.

### XSSFWorkbook의 문제점

XSSFWorkbook은 Excel 2007 이상의 XLSX 파일 형식을 처리하는 라이브러리입니다. 하지만 다음과 같은 치명적인 단점이 있습니다:

1. **메모리 상주 방식**: 전체 워크북 데이터를 메모리에 올려서 처리합니다.
2. **대용량 데이터 취약**: 모든 행(Row)과 셀(Cell) 객체를 메모리에 유지하므로, 데이터가 많을수록 메모리 사용량이 기하급수적으로 증가합니다.
3. **GC 부담 증가**: 많은 객체 생성으로 인해 Garbage Collection이 빈번하게 발생하여 성능이 저하됩니다.

30만 건의 데이터를 처리할 경우, 각 행과 셀에 대한 객체가 모두 메모리에 생성되어 수 GB의 메모리를 소비하게 됩니다.

## 해결 방법

### 1. 서버 HEAP 메모리 증설

가장 간단한 해결 방법은 서버의 Heap 메모리를 증설하는 것입니다. 운영 중인 서버의 메모리가 부족한 경우 고려해볼 수 있습니다.

**하지만 이 방법은 권장하지 않습니다:**
- 비용이 증가합니다.
- 근본적인 원인을 해결하지 못합니다.
- 데이터가 더 많아질수록 계속 메모리를 증설해야 하는 악순환이 반복됩니다.

### 2. SXSSFWorkbook 사용 (✅ 선택)

**SXSSFWorkbook**은 XSSFWorkbook의 메모리 문제를 해결하기 위해 만들어진 스트리밍 방식의 라이브러리입니다.

#### SXSSFWorkbook의 동작 원리

- **Sliding Window 방식**: 일정 개수의 행만 메모리에 유지하고, 나머지는 임시 파일로 flush합니다.
- **메모리 효율성**: 설정한 window size만큼만 메모리에 유지되므로, 데이터 크기와 무관하게 일정한 메모리만 사용합니다.
- **스트리밍 처리**: 데이터를 순차적으로 처리하여 디스크에 기록하므로 대용량 데이터에 적합합니다.

## 코드 적용

SXSSFWorkbook을 적용한 코드는 다음과 같습니다:
```java
// 기존 코드 (XSSFWorkbook)
public void downloadExcelOld(List dataList, HttpServletResponse response) {
    XSSFWorkbook workbook = new XSSFWorkbook();
    Sheet sheet = workbook.createSheet("Data");
    
    // 헤더 생성
    Row headerRow = sheet.createRow(0);
    headerRow.createCell(0).setCellValue("ID");
    headerRow.createCell(1).setCellValue("Name");
    headerRow.createCell(2).setCellValue("Value");
    
    // 데이터 입력 (모두 메모리에 적재됨)
    for (int i = 0; i < dataList.size(); i++) {
        Row row = sheet.createRow(i + 1);
        DataDto data = dataList.get(i);
        row.createCell(0).setCellValue(data.getId());
        row.createCell(1).setCellValue(data.getName());
        row.createCell(2).setCellValue(data.getValue());
    }
    
    // 파일 출력
    workbook.write(response.getOutputStream());
    workbook.close();
}

// 개선된 코드 (SXSSFWorkbook)
public void downloadExcelNew(List dataList, HttpServletResponse response) {
    // 100개 행만 메모리에 유지, 나머지는 디스크로 flush
    SXSSFWorkbook workbook = new SXSSFWorkbook(100);
    Sheet sheet = workbook.createSheet("Data");
    
    // 헤더 생성
    Row headerRow = sheet.createRow(0);
    headerRow.createCell(0).setCellValue("ID");
    headerRow.createCell(1).setCellValue("Name");
    headerRow.createCell(2).setCellValue("Value");
    
    // 데이터 입력 (스트리밍 방식)
    for (int i = 0; i < dataList.size(); i++) {
        Row row = sheet.createRow(i + 1);
        DataDto data = dataList.get(i);
        row.createCell(0).setCellValue(data.getId());
        row.createCell(1).setCellValue(data.getName());
        row.createCell(2).setCellValue(data.getValue());
    }
    
    // 파일 출력
    workbook.write(response.getOutputStream());
    workbook.close();
    workbook.dispose(); // 임시 파일 삭제
}
```

## 결과

### 메모리 사용량 비교

#### XSSFWorkbook 사용 시
![XSSFWorkbook 메모리 사용량](./excel.png)
- **Heap 최대 사용량**: 약 4GB
- **처리 시간**: 20~30초 이상

#### SXSSFWorkbook 사용 시
![SXSSFWorkbook 메모리 사용량](./excel2.png)
- **Heap 최대 사용량**: 약 400MB
- **처리 시간**: 7초

### 성능 개선 결과

| 항목 | XSSFWorkbook | SXSSFWorkbook | 개선율 |
|------|--------------|---------------|--------|
| 메모리 사용량 | ~4,000MB | ~400MB | **90% 감소** |
| 처리 시간 | 20~30초 | 7초 | **약 70% 단축** |

메모리 사용량은 **10분의 1 수준으로 감소**했으며, 처리 속도는 **약 3~4배 향상**되었습니다. OOM 문제도 완전히 해결되어 안정적인 서비스 운영이 가능해졌습니다.

## 결론

대용량 엑셀 다운로드 기능 구현 시에는 반드시 메모리 효율성을 고려해야 합니다. XSSFWorkbook 대신 **SXSSFWorkbook**을 사용하면 다음과 같은 이점을 얻을 수 있습니다:

- ✅ 메모리 사용량 대폭 감소
- ✅ 처리 속도 향상
- ✅ 서버 안정성 확보
- ✅ 비용 절감 (메모리 증설 불필요)

데이터 규모가 큰 경우, 라이브러리 선택이 시스템 전체의 안정성에 큰 영향을 미칠 수 있다는 것을 다시 한번 깨닫게 된 경험이었습니다.